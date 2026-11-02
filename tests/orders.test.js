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
const { createOrderService } = require('../src/services/orders');
const validate = require('../src/validators/orders');
const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test';
if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/mygarb_phasonable_test$/.test(uri)) throw new Error('Unsafe test database');
const config = { nodeEnv: 'test', origins: ['http://localhost:3000'], mongoUri: uri, jwtSecret: randomBytes(32).toString('hex'), sessionTtlSeconds: 3600 };
const suffix = randomBytes(12).toString('hex');
const ids = [];
let database, app, customer, other, designer, outsider, admin;
const future = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const measurements = { unit: 'cm', values: [{ label: 'Chest', value: 90 }] };
const payload = () => ({ designerId: designer.id, outfitType: 'Sample outfit', description: 'Fictional test request', quantity: 2,
  desiredCompletionDate: future(30), budgetAmount: '25000.50', referenceImageUrls: ['https://example.com/sample.jpg'], shareMeasurements: true });
const proposal = () => ({ decision: 'accepted', responseText: 'I can make this sample outfit.', priceAmount: '27500.25', completionDate: future(40) });
function call(method, path, user, body, target = app) {
  const req = request(target)[method]('/api' + path);
  if (user) req.set('Cookie', user.cookie);
  if (body !== undefined) req.set('X-MYGARB-Request', '1').send(body);
  return req;
}
async function submit(user = customer) { return (await call('post', '/requests', user, payload()).expect(201)).body.data.request; }
async function accepted() { const item = await submit(); await call('patch', `/requests/${item.id}/decision`, designer, proposal()).expect(200); return item; }
before(async () => {
  database = createDatabase(); await database.connect(uri); await database.prepareAuth();
  app = createApp({ config, database, logger: { info() {} }, rateLimitMax: 5000 });
  const password = randomBytes(20).toString('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const users = [];
  for (const role of ['customer', 'customer', 'designer', 'designer', 'admin']) {
    const email = `m4-${ids.length}-${suffix}@example.test`;
    const record = await database.models.User.create({ name: 'M4 fictional fixture', email, passwordHash, role,
      measurements: role === 'customer' ? { ...measurements, updatedAt: new Date() } : undefined,
      designer: role === 'designer' ? { businessName: 'Sample Studio', location: 'Sample City', specialties: ['Formal'], available: false,
        portfolio: [{ title: 'Sample', category: 'Formal', imageUrl: 'https://example.com/sample.jpg' }] } : undefined });
    ids.push(record._id);
    const { token } = await createAuthService({ config, models: database.models }).login({ email, password });
    users.push({ id: String(record._id), role, cookie: `mygarb_session=${token}` });
  }
  [customer, other, designer, outsider, admin] = users;
});
after(async () => {
  if (!database) return;
  try {
    if (!database.isReady()) await database.connect(uri);
    await database.models.Order.deleteMany({ customerId: { $in: ids } });
    await database.models.Request.deleteMany({ customerId: { $in: ids } });
    await database.models.Session.deleteMany({ userId: { $in: ids } });
    await database.models.User.deleteMany({ _id: { $in: ids } });
    for (const model of [database.models.Request, database.models.Order]) assert.equal(await model.countDocuments({ customerId: { $in: ids } }), 0);
  } finally { await database.close(); }
});

test('M4 submission requires customer, explicit sharing and bounded validated fields', async () => {
  await call('post', '/requests', undefined, payload()).expect(401);
  for (const user of [designer, admin]) await call('post', '/requests', user, payload()).expect(403);
  const invalid = [{ shareMeasurements: false }, { shareMeasurements: 'true' }, { quantity: 0 }, { quantity: 1.5 }, { quantity: 101 },
    { outfitType: '' }, { description: 'x'.repeat(4001) }, { customerId: other.id }, { status: 'confirmed' }, { measurementSnapshot: measurements },
    { designerId: { $ne: null } }, { referenceImageUrls: ['http://127.0.0.1/private'] }, { referenceImageUrls: Array(6).fill('https://example.com/a') },
    ...['0', '-1', '1e3', '01.00', '1.001', '100000000.01', 'NaN', 123, null].map(budgetAmount => ({ budgetAmount })),
    ...[future(0), future(-1), future(731), '2027-02-30', '2027-01-01T00:00:00Z', 'tomorrow'].map(desiredCompletionDate => ({ desiredCompletionDate }))];
  for (const changes of invalid) await call('post', '/requests', customer, { ...payload(), ...changes }).expect(400);
  assert.equal(validate.submission({ ...payload(), budgetAmount: '0.01' }).budgetKobo, 1);
  assert.equal(validate.submission({ ...payload(), budgetAmount: '100000000.00' }).budgetKobo, 10000000000);
  await call('post', '/requests', customer, { ...payload(), description: 'x'.repeat(17000) }).expect(413);
});

test('M4 submission uses only eligible designers and nonempty current customer measurements', async () => {
  await call('post', '/requests', customer, { ...payload(), designerId: other.id }).expect(409);
  await database.models.User.updateOne({ _id: designer.id }, { $set: { 'designer.businessName': '' } });
  await call('post', '/requests', customer, payload()).expect(409);
  await database.models.User.updateOne({ _id: designer.id }, { $set: { 'designer.businessName': 'Sample Studio', status: 'suspended' } });
  await call('post', '/requests', customer, payload()).expect(409);
  await database.models.User.updateOne({ _id: designer.id }, { $set: { status: 'active' } });
  await call('put', '/measurements', customer, { unit: 'cm', values: [] }).expect(200);
  const response = await call('post', '/requests', customer, payload()).expect(409);
  assert.equal(response.body.error.code, 'MEASUREMENTS_REQUIRED');
  await call('put', '/measurements', customer, measurements).expect(200);
  const item = await submit(); // available=false is intentionally informational.
  assert.deepEqual(item.measurementSnapshot.values, measurements.values);
  assert.equal(item.budgetAmount, '25000.50');
  await call('put', '/measurements', customer, { unit: 'in', values: [{ label: 'Waist', value: 30 }] }).expect(200);
  assert.deepEqual((await call('get', '/requests/' + item.id, designer).expect(200)).body.data.request.measurementSnapshot, item.measurementSnapshot);
  await call('put', '/measurements', customer, measurements).expect(200);
});

test('M4 request ownership, active-account/role enforcement and private list projections', async () => {
  const item = await submit();
  for (const user of [other, outsider]) await call('get', '/requests/' + item.id, user).expect(404);
  await call('get', '/requests/' + item.id, admin).expect(403);
  await call('get', '/requests/' + item.id).expect(401);
  await call('get', '/requests/invalid', customer).expect(400);
  await call('get', '/requests?customerId=' + customer.id, other).expect(400);
  for (const query of ['page=0', 'page=1001', 'limit=51', 'status[$ne]=x', 'status=submitted&status=accepted', 'status=ready']) await call('get', '/requests?' + query, customer).expect(400);
  const list = (await call('get', '/requests?limit=1&status=submitted', customer).expect(200)).body.data;
  assert.equal(list.requests.length, 1); assert.equal(list.hasMore, true);
  for (const field of ['measurementSnapshot', 'description', 'referenceImageUrls', 'passwordHash', 'email', 'phone']) assert.equal(list.requests[0][field], undefined);
  assert.equal((await call('get', '/requests?status=declined', other).expect(200)).body.data.requests.length, 0);
  await database.models.User.updateOne({ _id: customer.id }, { $set: { status: 'suspended' } });
  await call('get', '/requests', customer).expect(401);
  await call('patch', `/requests/${item.id}/cancel`, customer, {}).expect(401);
  await database.models.User.updateOne({ _id: customer.id }, { $set: { status: 'active', role: 'designer' } });
  await call('get', '/requests/' + item.id, customer).expect(404);
  await database.models.User.updateOne({ _id: customer.id }, { $set: { role: 'customer' } });
});

test('M4 decisions require response text and enforce terminal/cancellation rules', async () => {
  const item = await submit();
  await call('patch', `/requests/${item.id}/decision`, customer, proposal()).expect(403);
  await call('patch', `/requests/${item.id}/decision`, outsider, proposal()).expect(404);
  for (const input of [{ ...proposal(), responseText: '' }, { ...proposal(), priceAmount: '0' }, { ...proposal(), completionDate: future(0) },
    { decision: 'declined', responseText: 'Unable', priceAmount: '1' }, { ...proposal(), responseText: 'x'.repeat(2001) }, { ...proposal(), status: 'confirmed' }]) await call('patch', `/requests/${item.id}/decision`, designer, input).expect(400);
  await call('patch', `/requests/${item.id}/decision`, designer, { decision: 'declined', responseText: 'Unable to meet the brief.' }).expect(200);
  for (const action of ['cancel', 'confirm']) await call('patch', `/requests/${item.id}/${action}`, customer, {}).expect(409);
  await call('patch', `/requests/${item.id}/decision`, designer, proposal()).expect(409);
  const cancelled = await submit();
  await call('patch', `/requests/${cancelled.id}/cancel`, other, {}).expect(404);
  await call('patch', `/requests/${cancelled.id}/cancel`, designer, {}).expect(403);
  await call('patch', `/requests/${cancelled.id}/cancel`, customer, {}).expect(200);
  await call('patch', `/requests/${cancelled.id}/decision`, designer, proposal()).expect(409);
  const rejectedProposal = await accepted();
  await call('patch', `/requests/${rejectedProposal.id}/cancel`, customer, {}).expect(200);
  await call('patch', `/requests/${rejectedProposal.id}/confirm`, customer, {}).expect(409);
  assert.equal(await database.models.Order.countDocuments({ requestId: { $in: [item.id, cancelled.id, rejectedProposal.id] } }), 0);
});

test('M4 concurrent designer decisions and cancel/confirm races have one winner', async () => {
  const item = await submit();
  const decisions = await Promise.all([call('patch', `/requests/${item.id}/decision`, designer, proposal()), call('patch', `/requests/${item.id}/decision`, designer, { decision: 'declined', responseText: 'Unavailable' })]);
  assert.deepEqual(decisions.map(r => r.status).sort(), [200, 409]);
  const pending = await accepted();
  const raced = await Promise.all([call('patch', `/requests/${pending.id}/cancel`, customer, {}), call('patch', `/requests/${pending.id}/confirm`, customer, {})]);
  assert.deepEqual(raced.map(r => r.status).sort(), [200, 409]);
  const stored = await database.models.Request.findById(pending.id);
  assert.equal(await database.models.Order.countDocuments({ requestId: pending.id }), stored.status === 'confirmed' ? 1 : 0);
});

test('M4 repeated/concurrent confirmations create one order with frozen terms and one initial event', async () => {
  const item = await accepted();
  await call('patch', `/requests/${item.id}/confirm`, other, {}).expect(404);
  await call('patch', `/requests/${item.id}/confirm`, designer, {}).expect(403);
  await call('patch', `/requests/${item.id}/confirm`, customer, { priceAmount: '1' }).expect(400);
  const responses = await Promise.all(Array.from({ length: 8 }, () => call('patch', `/requests/${item.id}/confirm`, customer, {}).expect(200)));
  assert.equal(new Set(responses.map(r => r.body.data.order.id)).size, 1);
  const order = responses[0].body.data.order;
  assert.equal(order.id, item.id); assert.equal(order.priceAmount, '27500.25'); assert.equal(order.history.length, 1);
  assert.equal(await database.models.Order.countDocuments({ requestId: item.id }), 1);
  const indexes = await database.models.Order.collection.indexes();
  assert.ok(indexes.some(index => index.unique && index.key.requestId === 1));
  assert.deepEqual(database.models.Request.schema.options.writeConcern, { w: 1, j: true });
  assert.deepEqual(database.models.Order.schema.options.writeConcern, { w: 1, j: true });
  assert.deepEqual(order.measurementSnapshot, item.measurementSnapshot);
  await call('put', '/measurements', customer, { unit: 'in', values: [{ label: 'Waist', value: 32 }] }).expect(200);
  const read = (await call('get', '/orders/' + order.id, designer).expect(200)).body.data.order;
  assert.deepEqual(read.measurementSnapshot, item.measurementSnapshot);
  await call('patch', `/requests/${item.id}/cancel`, customer, {}).expect(409);
  await call('patch', `/requests/${item.id}/decision`, designer, proposal()).expect(409);
  await call('patch', `/orders/${item.id}/measurements`, customer, measurements).expect(404);
  await call('put', '/measurements', customer, measurements).expect(200);
});

test('M4 first confirmation rejects past proposal dates/inactive designer, but committed intent recovers', async () => {
  const item = await accepted();
  await database.models.Request.updateOne({ _id: item.id }, { $set: { 'proposal.completionDate': future(0) } });
  await call('patch', `/requests/${item.id}/confirm`, customer, {}).expect(409);
  assert.equal(await database.models.Order.countDocuments({ requestId: item.id }), 0);
  await database.models.Request.updateOne({ _id: item.id }, { $set: { 'proposal.completionDate': future(40) } });
  await database.models.User.updateOne({ _id: designer.id }, { $set: { status: 'suspended' } });
  await call('patch', `/requests/${item.id}/confirm`, customer, {}).expect(409);
  await database.models.User.updateOne({ _id: designer.id }, { $set: { status: 'active' } });
});

test('M4 durable confirmation recovers failure before insert across an actual process restart', { timeout: 30000 }, async () => {
  const item = await accepted();
  const failing = createOrderService({ ...database.models, Order: { findOneAndUpdate() { throw new Error('private database failure'); } } });
  await assert.rejects(failing.confirm(customer, item.id), { status: 503, code: 'CONFIRMATION_PENDING' });
  assert.equal(await database.models.Order.countDocuments({ requestId: item.id }), 0);
  const intent = await database.models.Request.findById(item.id).lean();
  assert.equal(intent.status, 'confirmed');
  assert.equal((await call('get', '/requests/' + item.id, customer).expect(200)).body.data.request.orderPending, true);
  await call('patch', `/requests/${item.id}/cancel`, customer, {}).expect(409);
  // A committed intent remains recoverable even when the proposal date is now past.
  await database.models.Request.updateOne({ _id: item.id }, { $set: { 'proposal.completionDate': future(-1) } });
  const source = `require('./src/server').startServer({config:{...require('./src/config/env').loadConfig(),port:0},logger:{info(){}}}).then(r=>{process.send(r.server.address().port);process.once('message',async()=>{await r.close();process.disconnect();});}).catch(()=>{process.exitCode=1;process.disconnect();});`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const child = spawn(process.execPath, ['-e', source], { env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, JWT_SECRET: config.jwtSecret, FRONTEND_ORIGINS: config.origins[0] }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const exited = once(child, 'exit');
    try {
      const port = await Promise.race([once(child, 'message').then(([value]) => value), exited.then(() => { throw new Error('Test process startup failed'); })]);
      const order = (await call('patch', `/requests/${item.id}/confirm`, customer, {}, `http://127.0.0.1:${port}`).expect(200)).body.data.order;
      assert.equal(order.id, item.id); assert.equal(order.history.length, 1);
      assert.equal(order.history[0].at, intent.confirmedAt.toISOString());
      assert.deepEqual(order.measurementSnapshot, item.measurementSnapshot);
    } finally { if (child.exitCode === null) child.send('close'); await exited; }
  }
  assert.equal(await database.models.Order.countDocuments({ requestId: item.id }), 1);
  assert.equal((await call('get', '/requests/' + item.id, customer).expect(200)).body.data.request.orderPending, false);
});

test('M4 lost insert response and failure before intent never duplicate or fabricate orders', async () => {
  const item = await accepted();
  const real = database.models.Order;
  const failing = createOrderService({ ...database.models, Order: { findOneAndUpdate(...args) { return { async lean() { await real.findOneAndUpdate(...args).lean(); throw new Error('lost response'); } }; } } });
  await assert.rejects(failing.confirm(customer, item.id), { code: 'CONFIRMATION_PENDING' });
  const first = await real.findOne({ requestId: item.id }).lean();
  const retried = await createOrderService(database.models).confirm(customer, item.id);
  assert.equal(retried.history.length, 1); assert.equal(retried.updatedAt.toISOString(), first.updatedAt.toISOString());
  const beforeIntent = await accepted();
  const broken = createOrderService({ ...database.models, Request: { findOne: (...args) => database.models.Request.findOne(...args), findOneAndUpdate() { throw new Error('before intent'); } } });
  await assert.rejects(broken.confirm(customer, beforeIntent.id));
  assert.equal((await database.models.Request.findById(beforeIntent.id)).status, 'accepted');
  assert.equal(await real.countDocuments({ requestId: beforeIntent.id }), 0);
  await call('patch', `/requests/${beforeIntent.id}/confirm`, customer, {}).expect(200);
});

test('M4 order access, sequential transitions, retries, histories and list privacy', async () => {
  const item = await accepted();
  await call('patch', `/requests/${item.id}/confirm`, customer, {}).expect(200);
  for (const user of [other, outsider]) await call('get', '/orders/' + item.id, user).expect(404);
  await call('get', '/orders', admin).expect(403);
  await call('get', '/orders/' + item.id).expect(401);
  await call('patch', `/orders/${item.id}/status`, customer, { status: 'in_progress' }).expect(403);
  await call('patch', `/orders/${item.id}/status`, outsider, { status: 'in_progress' }).expect(404);
  await call('patch', `/orders/${item.id}/status`, designer, { status: 'ready' }).expect(409);
  for (const input of [{ status: 'paid' }, { status: 'in_progress', priceKobo: 1 }, { status: 'in_progress', history: [] }]) await call('patch', `/orders/${item.id}/status`, designer, input).expect(400);
  await database.models.User.updateOne({ _id: designer.id }, { $set: { status: 'suspended' } });
  await call('patch', `/orders/${item.id}/status`, designer, { status: 'in_progress' }).expect(401);
  await database.models.User.updateOne({ _id: designer.id }, { $set: { status: 'active' } });
  await Promise.all(Array.from({ length: 5 }, () => call('patch', `/orders/${item.id}/status`, designer, { status: 'in_progress' }).expect(200)));
  await call('patch', `/orders/${item.id}/status`, customer, { status: 'completed' }).expect(409);
  await call('patch', `/orders/${item.id}/status`, designer, { status: 'ready' }).expect(200);
  await call('patch', `/orders/${item.id}/status`, designer, { status: 'completed' }).expect(403);
  const completed = (await call('patch', `/orders/${item.id}/status`, customer, { status: 'completed' }).expect(200)).body.data.order;
  await call('patch', `/orders/${item.id}/status`, customer, { status: 'completed' }).expect(200);
  await call('patch', `/orders/${item.id}/status`, designer, { status: 'in_progress' }).expect(409);
  assert.deepEqual(completed.history.map(event => event.status), ['confirmed', 'in_progress', 'ready', 'completed']);
  assert.deepEqual(completed.history.map(event => event.actorId), [customer.id, designer.id, designer.id, customer.id]);
  for (let i = 1; i < completed.history.length; i++) assert.ok(completed.history[i].at >= completed.history[i - 1].at);
  const retry = (await call('patch', `/requests/${item.id}/confirm`, customer, {}).expect(200)).body.data.order;
  assert.equal(retry.status, 'completed'); assert.deepEqual(retry.history, completed.history);
  const list = (await call('get', '/orders?status=completed&limit=1', customer).expect(200)).body.data;
  assert.equal(list.orders.length, 1); assert.equal(list.orders[0].measurementSnapshot, undefined); assert.equal(list.orders[0].history, undefined);
  await call('get', '/orders?status=accepted', customer).expect(400);
});

test('M4 writes retain CSRF/JSON protections and safe errors', async () => {
  const item = await accepted();
  for (const [method, path, user, body] of [['post', '/requests', customer, payload()], ['patch', `/requests/${item.id}/confirm`, customer, {}],
    ['patch', `/requests/${item.id}/decision`, designer, proposal()], ['patch', `/requests/${item.id}/cancel`, customer, {}], ['patch', `/orders/${item.id}/status`, designer, { status: 'ready' }]]) {
    await request(app)[method]('/api' + path).set('Cookie', user.cookie).send(body).expect(403);
    await call(method, path, user, body).set('Origin', 'https://untrusted.example').expect(403);
    await call(method, path, user, body).set('Sec-Fetch-Site', 'cross-site').expect(403);
    await request(app)[method]('/api' + path).set('Cookie', user.cookie).set('X-MYGARB-Request', '1').type('form').send('x=y').expect(415);
  }
  const brokenModels = { ...database.models, Order: { ...database.models.Order, findOneAndUpdate() { throw new Error('private-connection-secret'); } } };
  const brokenApp = createApp({ config, database: { models: brokenModels }, logger: { info() {} } });
  const response = await call('patch', `/requests/${item.id}/confirm`, customer, {}, brokenApp).expect(503);
  assert.equal(response.body.error.code, 'CONFIRMATION_PENDING');
  assert.ok(!response.text.includes('private-connection-secret'));
  await call('patch', `/requests/${item.id}/confirm`, customer, {}).expect(200);
});
