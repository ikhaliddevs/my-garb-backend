const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { createDatabase } = require('../src/config/database');
const { createApp } = require('../src/app');
const { createAuthService } = require('../src/services/auth');
const { createCommunicationService } = require('../src/services/communication');
const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test';
if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/mygarb_phasonable_test$/.test(uri)) throw new Error('Unsafe test database');
const config = { nodeEnv: 'test', origins: ['http://localhost:3000'], mongoUri: uri, jwtSecret: randomBytes(32).toString('hex'), sessionTtlSeconds: 3600 };
const ids = [], suffix = randomBytes(12).toString('hex');
let db, app, customer, designer, other, outsider, admin;
const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const original = { unit: 'cm', values: [{ label: 'Chest', value: 90 }] };
const proposal = (expectedVersion = 0, value = 95) => ({ expectedVersion, unit: 'cm', values: [{ label: 'Chest', value }], explanation: 'Please review these exact corrected measurements.' });
function call(method, path, user, body, target = app) {
  const r = request(target)[method]('/api' + path);
  if (user) r.set('Cookie', user.cookie);
  if (body !== undefined) r.set('X-MYGARB-Request', '1').send(body);
  return r;
}
async function submit(c = customer, d = designer) {
  return (await call('post', '/requests', c, { designerId: d.id, outfitType: 'Sample', description: 'Fictional request', quantity: 1, desiredCompletionDate: future, budgetAmount: '1000.00', shareMeasurements: true }).expect(201)).body.data.request;
}
async function confirm(r, c = customer, d = designer) {
  await call('patch', `/requests/${r.id}/decision`, d, { decision: 'accepted', responseText: 'Agreed', priceAmount: '1000.00', completionDate: future }).expect(200);
  return (await call('patch', `/requests/${r.id}/confirm`, c, {}).expect(200)).body.data.order;
}
before(async () => {
  db = createDatabase(); await db.connect(uri); await db.prepareAuth();
  app = createApp({ config, database: db, logger: { info() {} }, rateLimitMax: 10000 });
  const password = randomBytes(20).toString('hex'), passwordHash = await bcrypt.hash(password, 12), users = [];
  for (const role of ['customer', 'designer', 'customer', 'designer', 'admin']) {
    const email = `m5-${ids.length}-${suffix}@example.test`;
    const r = await db.models.User.create({ name: 'M5 fictional fixture', email, passwordHash, role, emailVerified: true,
      measurements: role === 'customer' ? { ...original, updatedAt: new Date() } : undefined,
      designer: role === 'designer' ? { businessName: 'Sample Studio', location: 'Sample City', specialties: ['Formal'], available: true, portfolio: [{ title: 'Sample', category: 'Formal', imageUrl: 'https://example.com/sample.jpg' }] } : undefined });
    ids.push(r._id);
    const { token } = await createAuthService({ config, models: db.models }).login({ email, password });
    users.push({ id: String(r._id), role, cookie: `mygarb_session=${token}` });
  }
  [customer, designer, other, outsider, admin] = users;
});
after(async () => {
  if (!db) return;
  try {
    if (!db.isReady()) await db.connect(uri);
    for (const [Model, field] of [[db.models.Notification, 'recipientId'], [db.models.Order, 'customerId'], [db.models.Request, 'customerId'], [db.models.Session, 'userId'], [db.models.User, '_id']]) {
      await Model.deleteMany({ [field]: { $in: ids } });
      assert.equal(await Model.countDocuments({ [field]: { $in: ids } }), 0);
    }
  } finally { await db.close(); }
});
test('M5 participant messages retain actor/time, plain text, pagination and confirmed order linkage', async () => {
  const r = await submit();
  const text = '<script>alert("sample")</script>\nPlain text & symbols';
  const m = (await call('post', `/requests/${r.id}/messages`, customer, { text }).expect(201)).body.data;
  assert.equal(m.message.text, text); assert.equal(m.message.actorId, customer.id); assert.equal(m.orderId, null);
  await confirm(r);
  await call('post', `/requests/${r.id}/messages`, designer, { text: 'Order conversation' }).expect(201);
  const first = (await call('get', `/requests/${r.id}/messages?limit=1`, customer).expect(200)).body.data;
  assert.equal(first.orderId, r.id); assert.equal(first.messages[0].id, m.message.id); assert.equal(first.hasMore, true);
  const second = (await call('get', `/requests/${r.id}/messages?page=2&limit=1`, designer).expect(200)).body.data;
  assert.equal(second.messages[0].text, 'Order conversation'); assert.equal(second.hasMore, false);
  for (const field of ['email', 'phone', 'passwordHash', 'recipientId', 'events']) assert.equal(second.messages[0][field], undefined);
});
test('M5 unrelated/admin/suspended/changed-role users cannot read or write private conversations or amendments', async () => {
  const r = await submit(); await confirm(r);
  for (const path of [`/requests/${r.id}/messages`, `/orders/${r.id}/amendments`]) {
    await call('get', path).expect(401);
    for (const user of [other, outsider]) await call('get', path, user).expect(404);
    await call('get', path, admin).expect(403);
    await db.models.User.updateOne({ _id: customer.id }, { $set: { status: 'suspended' } });
    await call('get', path, customer).expect(401);
    await db.models.User.updateOne({ _id: customer.id }, { $set: { status: 'active', role: 'designer' } });
    await call('get', path, customer).expect(404);
    await db.models.User.updateOne({ _id: customer.id }, { $set: { role: 'customer' } });
  }
  await call('post', `/requests/${r.id}/messages`, other, { text: 'No' }).expect(404);
  await call('post', `/orders/${r.id}/amendments`, customer, proposal()).expect(403);
  await call('post', `/orders/${r.id}/amendments`, outsider, proposal()).expect(404);
  await call('patch', `/orders/${r.id}/amendments/accept`, designer, { version: 1 }).expect(403);
  await call('patch', `/orders/${r.id}/amendments/withdraw`, customer, { version: 1 }).expect(403);
});
test('M5 bounded bodies, unknown fields, query validation and CSRF protections apply', async () => {
  const r = await submit(); await confirm(r);
  for (const body of [{ text: '' }, { text: 'x'.repeat(2001) }, { text: 'x\u0000' }, { text: 12 }, { text: 'hello', actorId: customer.id }]) await call('post', `/requests/${r.id}/messages`, customer, body).expect(400);
  await call('post', `/requests/${r.id}/messages`, customer, { text: 'x'.repeat(17000) }).expect(413);
  for (const query of ['limit=51', 'page=0', 'page=1001', 'ownerId=x', 'limit=1&limit=2']) {
    await call('get', `/requests/${r.id}/messages?${query}`, customer).expect(400);
    await call('get', '/notifications?' + query, customer).expect(400);
  }
  for (const body of [{ ...proposal(), values: [] }, { ...proposal(), unit: 'mm' }, { ...proposal(), expectedVersion: '0' }, { ...proposal(), expectedVersion: -1 }, { ...proposal(), acceptedAt: new Date() }]) await call('post', `/orders/${r.id}/amendments`, designer, body).expect(400);
  for (const [method, path, user, body] of [['post', `/requests/${r.id}/messages`, customer, { text: 'hello' }], ['post', `/orders/${r.id}/amendments`, designer, proposal()], ['patch', `/orders/${r.id}/amendments/accept`, customer, { version: 1 }], ['patch', `/orders/${r.id}/amendments/withdraw`, designer, { version: 1 }], ['patch', `/notifications/${r.id}/read`, customer, {}]]) {
    await request(app)[method]('/api' + path).set('Cookie', user.cookie).send(body).expect(403);
    await call(method, path, user, body).set('Origin', 'https://untrusted.example').expect(403);
    await call(method, path, user, body).set('Sec-Fetch-Site', 'cross-site').expect(403);
    await request(app)[method]('/api' + path).set('Cookie', user.cookie).set('X-MYGARB-Request', '1').type('form').send('x=y').expect(415);
  }
});
test('M5 declined/cancelled/completed conversations become read-only and never lose history', async () => {
  for (const status of ['declined', 'cancelled', 'completed']) {
    const r = await submit();
    await call('post', `/requests/${r.id}/messages`, customer, { text: 'Retained' }).expect(201);
    if (status === 'declined') await call('patch', `/requests/${r.id}/decision`, designer, { decision: 'declined', responseText: 'Unavailable' }).expect(200);
    if (status === 'cancelled') await call('patch', `/requests/${r.id}/cancel`, customer, {}).expect(200);
    if (status === 'completed') {
      await confirm(r);
      for (const state of ['in_progress', 'ready', 'completed']) await call('patch', `/orders/${r.id}/status`, state === 'completed' ? customer : designer, { status: state }).expect(200);
    }
    for (const u of [customer, designer]) await call('post', `/requests/${r.id}/messages`, u, { text: 'Closed' }).expect(409);
    assert.equal((await call('get', `/requests/${r.id}/messages`, designer).expect(200)).body.data.messages[0].text, 'Retained');
  }
});
test('M5 exact version agreement preserves originals and previous accepted records, never infers consent from chat/profile', async () => {
  const r = await submit(); await confirm(r);
  const a = (await call('post', `/orders/${r.id}/amendments`, designer, proposal()).expect(201)).body.data.amendment;
  assert.equal(a.designerId, designer.id); assert.equal(a.customerId, customer.id);
  await call('post', `/requests/${r.id}/messages`, customer, { text: 'I agree' }).expect(201);
  await call('patch', `/orders/${r.id}/status`, designer, { status: 'in_progress' }).expect(409);
  let detail = (await call('get', `/orders/${r.id}`, customer).expect(200)).body.data.order;
  assert.deepEqual(detail.effectiveMeasurements, detail.measurementSnapshot);
  const results = await Promise.all(Array.from({ length: 4 }, () => call('patch', `/orders/${r.id}/amendments/accept`, customer, { version: 1 }).expect(200)));
  assert.equal(new Set(results.map(r => r.body.data.amendment.consentMessageId)).size, 1);
  const agreed = results[0].body.data.amendment;
  assert.equal(agreed.measurements.values[0].value, 95);
  await call('post', `/orders/${r.id}/amendments`, designer, proposal(1, 98)).expect(201);
  await call('patch', `/orders/${r.id}/amendments/withdraw`, designer, { version: 2 }).expect(200);
  await call('patch', `/orders/${r.id}/amendments/accept`, customer, { version: 2 }).expect(409);
  const audit = (await call('get', `/orders/${r.id}/amendments`, customer).expect(200)).body.data;
  assert.deepEqual(audit.amendments[0], agreed); assert.equal(audit.effectiveMeasurements.values[0].value, 95);
  const messages = (await call('get', `/requests/${r.id}/messages`, designer).expect(200)).body.data.messages;
  assert.equal(messages.find(m => m.id === a.proposalMessageId).kind, 'proposal');
  assert.equal(messages.filter(m => m.id === agreed.consentMessageId).length, 1);
  await call('patch', `/orders/${r.id}/status`, designer, { status: 'in_progress' }).expect(200);
  await call('post', `/orders/${r.id}/amendments`, designer, proposal(2)).expect(409);
  detail = (await call('get', `/orders/${r.id}`, customer).expect(200)).body.data.order;
  assert.equal(detail.measurementSnapshot.values[0].value, 90); assert.equal(detail.effectiveMeasurements.values[0].value, 95);
  assert.deepEqual((await call('get', `/requests/${r.id}`, customer).expect(200)).body.data.request.measurementSnapshot, r.measurementSnapshot);
});
test('M5 superseded proposals and concurrent version/production races cannot accept stale values', async () => {
  const r = await submit(); await confirm(r);
  const proposed = await Promise.all([95, 96].map(v => call('post', `/orders/${r.id}/amendments`, designer, proposal(0, v))));
  assert.deepEqual(proposed.map(r => r.status).sort(), [201, 409]);
  await call('post', `/orders/${r.id}/amendments`, designer, proposal(1, 97)).expect(201);
  await call('patch', `/orders/${r.id}/amendments/accept`, customer, { version: 1 }).expect(409);
  await call('patch', `/orders/${r.id}/amendments/withdraw`, designer, { version: 1 }).expect(409);
  const outcomes = await Promise.all([call('patch', `/orders/${r.id}/amendments/accept`, customer, { version: 2 }), call('post', `/orders/${r.id}/amendments`, designer, proposal(2, 99))]);
  assert.ok(outcomes.every(r => [200, 201, 409].includes(r.status)));
  const record = await db.models.Order.findById(r.id).lean();
  assert.ok(!(record.amendments[1].acceptedAt && record.amendments[1].supersededAt));
  if (record.pendingAmendment) await call('patch', `/orders/${r.id}/amendments/withdraw`, designer, { version: record.pendingAmendment }).expect(200);
  const v = (await db.models.Order.findById(r.id)).amendmentVersion;
  const race = await Promise.all([call('post', `/orders/${r.id}/amendments`, designer, proposal(v)), call('patch', `/orders/${r.id}/status`, designer, { status: 'in_progress' })]);
  assert.deepEqual(race.map(r => r.status).sort(), race[0].status === 201 ? [201, 409] : [200, 409]);
  const stored = await db.models.Order.findById(r.id).lean();
  assert.ok(stored.status !== 'in_progress' || !stored.pendingAmendment);
});
test('M5 notification outbox is durable, deduplicated and owner-only; same-state retries add no events', async () => {
  const r = await submit(); await confirm(r);
  await call('post', `/requests/${r.id}/messages`, customer, { text: 'Notice' }).expect(201);
  await call('patch', `/orders/${r.id}/status`, designer, { status: 'in_progress' }).expect(200);
  await call('patch', `/orders/${r.id}/status`, designer, { status: 'in_progress' }).expect(200);
  const lists = await Promise.all(Array.from({ length: 4 }, () => call('get', '/notifications?limit=50', designer).expect(200)));
  assert.ok(lists.every(r => r.body.data.deliveryPending === false));
  const stored = await db.models.Notification.find({ requestId: r.id }).lean();
  assert.equal(stored.filter(e => e.type === 'new_request').length, 1);
  assert.equal(stored.filter(e => e.type === 'confirmed').length, 1);
  assert.equal(stored.filter(e => e.type === 'new_message').length, 1);
  await call('get', '/notifications?limit=50', customer).expect(200);
  assert.equal(await db.models.Notification.countDocuments({ requestId: r.id, type: 'order_in_progress' }), 1);
  const n = stored.find(e => e.type === 'new_message');
  await call('patch', `/notifications/${n._id}/read`, customer, {}).expect(404);
  const read = (await call('patch', `/notifications/${n._id}/read`, designer, {}).expect(200)).body.data.notification;
  assert.deepEqual((await call('patch', `/notifications/${n._id}/read`, designer, {}).expect(200)).body.data.notification, read);
  await call('get', '/notifications', admin).expect(403);
  await db.models.User.updateOne({ _id: designer.id }, { $set: { status: 'suspended' } });
  await call('get', '/notifications', designer).expect(401);
  await db.models.User.updateOne({ _id: designer.id }, { $set: { status: 'active' } });
  const page = (await call('get', '/notifications?limit=1', designer).expect(200)).body.data;
  assert.equal(page.notifications.length, 1); assert.equal(page.hasMore, true);
  assert.deepEqual(Object.keys(page.notifications[0]).sort(), ['at', 'id', 'orderId', 'readAt', 'requestId', 'type']);
});
test('M5 partial notification delivery fails safely and retries recover without duplicates or read-state loss', async () => {
  const r = await submit();
  const real = db.models.Notification;
  let inserted = false;
  const service = createCommunicationService({ ...db.models, Notification: { async updateOne(...args) { await real.updateOne(...args); inserted = true; throw new Error('private-connection-secret'); } } });
  await assert.rejects(service.notifications(designer, { page: 1, limit: 50 }), { code: 'NOTIFICATIONS_PENDING' });
  assert.equal(inserted, true);
  const n = await real.findOne({ requestId: r.id }); assert.ok(n);
  await call('patch', `/notifications/${n._id}/read`, designer, {}).expect(200);
  const before = await real.findById(n._id).lean();
  await call('get', '/notifications', designer).expect(200);
  assert.equal(await real.countDocuments({ eventId: n.eventId }), 1);
  assert.equal((await real.findById(n._id)).readAt.toISOString(), before.readAt.toISOString());
  const r2 = await submit();
  const broken = createApp({ config, database: { models: { ...db.models, Notification: { updateOne() { throw new Error('private-connection-secret'); } } } }, logger: { info() {} } });
  const failure = await call('get', '/notifications', designer, undefined, broken).expect(503);
  assert.ok(!failure.text.includes('private-connection-secret'));
  assert.equal(await real.countDocuments({ requestId: r2.id }), 0);
  await call('get', '/notifications', designer).expect(200);
});
test('M5 actual process restart preserves messages, agreements and recovers pending notification events', { timeout: 30000 }, async () => {
  const r = await submit(); await confirm(r);
  await call('post', `/orders/${r.id}/amendments`, designer, proposal()).expect(201);
  await call('patch', `/orders/${r.id}/amendments/accept`, customer, { version: 1 }).expect(200);
  const source = `require('./src/server').startServer({config:{...require('./src/config/env').loadConfig(),port:0},logger:{info(){}}}).then(r=>{process.send(r.server.address().port);process.once('message',async()=>{await r.close();process.disconnect();});}).catch(()=>{process.exitCode=1;process.disconnect();});`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const child = spawn(process.execPath, ['-e', source], { windowsHide: true, env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, JWT_SECRET: config.jwtSecret, FRONTEND_ORIGINS: config.origins[0] }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const exited = once(child, 'exit');
    try {
      const port = await Promise.race([once(child, 'message').then(([p]) => p), exited.then(() => { throw new Error('Test process startup failed'); })]);
      const target = `http://127.0.0.1:${port}`;
      const a = (await call('get', `/orders/${r.id}/amendments`, customer, undefined, target).expect(200)).body.data;
      assert.equal(a.effectiveMeasurements.values[0].value, 95); assert.ok(a.amendments[0].acceptedAt);
      assert.equal((await call('get', `/requests/${r.id}/messages`, designer, undefined, target).expect(200)).body.data.messages.length, 2);
      await call('get', '/notifications', designer, undefined, target).expect(200);
    } finally { if (child.exitCode === null) child.send('close'); await exited; }
  }
  assert.equal(await db.models.Notification.countDocuments({ requestId: r.id, recipientId: designer.id }), 3);
});
test('M5 two separate customer/designer journeys preserve isolation through completion', async () => {
  for (const [c, d] of [[customer, designer], [other, outsider]]) {
    const r = await submit(c, d); await confirm(r, c, d);
    await call('post', `/requests/${r.id}/messages`, c, { text: 'My isolated journey' }).expect(201);
    await call('post', `/orders/${r.id}/amendments`, d, proposal()).expect(201);
    await call('patch', `/orders/${r.id}/amendments/accept`, c, { version: 1 }).expect(200);
    for (const status of ['in_progress', 'ready', 'completed']) await call('patch', `/orders/${r.id}/status`, status === 'completed' ? c : d, { status }).expect(200);
    await call('get', `/requests/${r.id}/messages`, c === customer ? other : customer).expect(404);
    await call('get', '/notifications', c).expect(200);
    const own = await db.models.Notification.find({ requestId: r.id, recipientId: c.id }).lean();
    assert.ok(own.some(n => n.type === 'order_ready'));
  }
});
test('M5 bounded conversation leaves room to consent/withdraw and rejects exhausted amendment versions', async () => {
  const r = await submit(); await confirm(r);
  const messages = Array.from({ length: 498 }, () => ({ actorId: customer.id, text: 'Bounded fixture', kind: 'text', at: new Date() }));
  await db.models.Order.updateOne({ _id: r.id }, { $set: { messages } });
  await call('post', `/orders/${r.id}/amendments`, designer, proposal()).expect(201);
  await call('post', `/requests/${r.id}/messages`, customer, { text: 'No space reserved for ordinary text' }).expect(409);
  await call('post', `/orders/${r.id}/amendments`, designer, proposal(1)).expect(409);
  await call('patch', `/orders/${r.id}/amendments/accept`, customer, { version: 1 }).expect(200);
  await call('post', `/requests/${r.id}/messages`, designer, { text: 'Full' }).expect(409);
  await call('patch', `/orders/${r.id}/status`, designer, { status: 'in_progress' }).expect(200);
  assert.equal((await db.models.Order.findById(r.id)).messages.length, 500);
  const limited = await submit(); await confirm(limited);
  await db.models.Order.updateOne({ _id: limited.id }, { $set: { amendmentVersion: 50 } });
  await call('post', `/orders/${limited.id}/amendments`, designer, proposal(50)).expect(409);
});
test('M5 notification acknowledgement failure retries preserve exactly one notification; legacy events are not invented', async () => {
  await call('get', '/notifications', designer).expect(200);
  const r = await submit();
  const service = createCommunicationService({ ...db.models, Request: { find: (...args) => db.models.Request.find(...args), updateOne() { throw new Error('ack failure'); } } });
  await assert.rejects(service.notifications(designer, { page: 1, limit: 20 }), { code: 'NOTIFICATIONS_PENDING' });
  assert.equal(await db.models.Notification.countDocuments({ requestId: r.id }), 1);
  assert.equal((await db.models.Request.findById(r.id)).events[0].delivered, false);
  await call('get', '/notifications', designer).expect(200);
  assert.equal(await db.models.Notification.countDocuments({ requestId: r.id }), 1);
  assert.equal((await db.models.Request.findById(r.id)).events[0].delivered, true);
  const legacy = await submit();
  await db.models.Request.updateOne({ _id: legacy.id }, { $unset: { events: 1, messages: 1 } });
  await call('get', '/notifications', designer).expect(200);
  assert.equal(await db.models.Notification.countDocuments({ requestId: legacy.id }), 0);
  await confirm(legacy);
  await db.models.Order.updateOne({ _id: legacy.id }, { $unset: { amendmentVersion: 1, pendingAmendment: 1, amendments: 1, messages: 1, events: 1 } });
  await call('post', `/orders/${legacy.id}/amendments`, designer, proposal()).expect(201);
});
test('M5 message/closure races never append after the terminal transition', async () => {
  const r = await submit();
  const results = await Promise.all([call('post', `/requests/${r.id}/messages`, customer, { text: 'Race' }), call('patch', `/requests/${r.id}/cancel`, customer, {})]);
  assert.equal(results[1].status, 200); assert.ok([201, 409].includes(results[0].status));
  const stored = await db.models.Request.findById(r.id).lean();
  assert.equal(stored.messages.length, results[0].status === 201 ? 1 : 0);
  await call('post', `/requests/${r.id}/messages`, designer, { text: 'After closure' }).expect(409);
  assert.equal((await db.models.Request.findById(r.id)).messages.length, stored.messages.length);
});
