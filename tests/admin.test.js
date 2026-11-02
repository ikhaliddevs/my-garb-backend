const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const request = require('supertest');
const { createDatabase } = require('../src/config/database');
const { createApp } = require('../src/app');
const { createAuthService } = require('../src/services/auth');
const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test';
if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/mygarb_phasonable_test$/.test(uri)) throw new Error('Unsafe test database');
const config = { nodeEnv: 'test', origins: ['http://localhost:3000'], mongoUri: uri, jwtSecret: randomBytes(32).toString('hex'), sessionTtlSeconds: 3600 };
const ids = [], users = [], suffix = randomBytes(12).toString('hex'), password = randomBytes(24).toString('hex');
let db, app, auth, admin, admin2;
function call(method, path, user, body) {
  const r = request(app)[method]('/api' + path);
  if (user) r.set('Cookie', user.cookie);
  if (body !== undefined) r.set('X-MYGARB-Request', '1').send(body);
  return r;
}
async function login(user) {
  const result = await auth.login({ email: user.email, password });
  user.cookie = `mygarb_session=${result.token}`;
}
before(async () => {
  db = createDatabase(); await db.connect(uri); await db.prepareAuth();
  app = createApp({ config, database: db, logger: { info() {} }, rateLimitMax: 10000, authRateLimitMax: 100 });
  auth = createAuthService({ models: db.models, config });
  for (const role of ['admin', 'admin', 'customer', 'designer', 'customer', 'designer']) {
    const email = `m6-${ids.length}-${suffix}@example.test`;
    const input = { name: 'M6 fictional fixture', email, password, role };
    const u = role === 'admin' ? await auth.register(input) : (await call('post', '/auth/register', null, input).expect(201)).body.data.user;
    ids.push(u.id); const user = { ...u, email }; await login(user); users.push(user);
  }
  [admin, admin2] = users;
});
after(async () => {
  if (!db) return;
  try {
    for (const [Model, field] of [[db.models.Notification, 'recipientId'], [db.models.Order, 'customerId'], [db.models.Request, 'customerId'], [db.models.Session, 'userId'], [db.models.User, '_id']]) {
      await Model.deleteMany({ [field]: { $in: ids } });
      assert.equal(await Model.countDocuments({ [field]: { $in: ids } }), 0);
    }
  } finally { await db.close(); }
});
test('M6 admin authorization uses current role/account and protects all list/write routes', async () => {
  for (const path of ['/admin/users', '/admin/requests', '/admin/orders']) {
    await call('get', path).expect(401);
    for (const u of users.slice(2)) await call('get', path, u).expect(403);
    await call('get', path, admin).expect(200);
  }
  await call('patch', `/admin/users/${users[2].id}/status`, users[3], { status: 'suspended' }).expect(403);
  await db.models.User.updateOne({ _id: admin2.id }, { $set: { role: 'customer' } });
  await call('get', '/admin/users', admin2).expect(403);
  await db.models.User.updateOne({ _id: admin2.id }, { $set: { role: 'admin', status: 'suspended' } });
  await call('get', '/admin/users', admin2).expect(401);
  await db.models.User.updateOne({ _id: admin2.id }, { $set: { status: 'active' } });
});
test('M6 pagination, allowlists, input bounds and CSRF reject unsafe requests', async () => {
  const a = (await call('get', '/admin/users?limit=1', admin).expect(200)).body.data;
  const b = (await call('get', '/admin/users?limit=1&page=2', admin).expect(200)).body.data;
  assert.equal(a.users.length, 1); assert.equal(a.hasMore, true); assert.notEqual(a.users[0].id, b.users[0].id);
  assert.deepEqual(Object.keys(a.users[0]).sort(), ['createdAt', 'id', 'name', 'role', 'status', 'updatedAt']);
  for (const path of ['/admin/users', '/admin/requests', '/admin/orders']) for (const q of ['page=0', 'page=1001', 'limit=51', 'limit=1&limit=2', 'email=x', 'status=active']) await call('get', path + '?' + q, admin).expect(400);
  const path = `/admin/users/${users[2].id}/status`;
  for (const body of [{}, { status: 'deleted' }, { status: 'active', role: 'admin' }, { status: ['active'] }]) await call('patch', path, admin, body).expect(400);
  await call('patch', path + '?extra=1', admin, { status: 'active' }).expect(400);
  await call('patch', '/admin/users/invalid/status', admin, { status: 'active' }).expect(400);
  await call('patch', '/admin/users/000000000000000000000001/status', admin, { status: 'active' }).expect(404);
  await request(app).patch('/api' + path).set('Cookie', admin.cookie).send({ status: 'active' }).expect(403);
  await call('patch', path, admin, { status: 'active' }).set('Origin', 'https://untrusted.example').expect(403);
  await call('patch', path, admin, { status: 'active' }).set('Sec-Fetch-Site', 'cross-site').expect(403);
  await request(app).patch('/api' + path).set('Cookie', admin.cookie).set('X-MYGARB-Request', '1').type('form').send('status=active').expect(415);
  await call('patch', path, admin, { status: 'x'.repeat(17000) }).expect(413);
});
test('M6 concurrent self/peer admin suspension cannot remove any active administrator', async () => {
  const results = await Promise.all([call('patch', `/admin/users/${admin.id}/status`, admin, { status: 'suspended' }), call('patch', `/admin/users/${admin2.id}/status`, admin, { status: 'suspended' }), call('patch', `/admin/users/${admin.id}/status`, admin2, { status: 'suspended' })]);
  for (const r of results) { assert.equal(r.status, 409); assert.equal(r.body.error.code, 'ADMIN_STATUS_PROTECTED'); }
  assert.equal(await db.models.User.countDocuments({ _id: { $in: [admin.id, admin2.id] }, status: 'active' }), 2);
});
test('M6 suspension atomically revokes all sessions; reactivation requires fresh login', async () => {
  for (const u of users.slice(2, 4)) {
    const oldCookie = u.cookie;
    const extra = await auth.login({ email: u.email, password });
    const path = `/admin/users/${u.id}/status`;
    const results = await Promise.all([call('patch', path, admin, { status: 'suspended' }), call('patch', path, admin2, { status: 'suspended' })]);
    results.forEach(r => assert.equal(r.status, 200));
    assert.equal((await db.models.User.findById(u.id)).sessionVersion, 1);
    await call('get', '/profile', u).expect(401);
    await call('post', '/auth/login', null, { email: u.email, password }).expect(401);
    await call('patch', path, admin, { status: 'active' }).expect(200);
    await call('get', '/auth/me', { cookie: oldCookie }).expect(401);
    const rebuilt = createAuthService({ config, models: db.models });
    await assert.rejects(rebuilt.authenticate(extra.token), { code: 'UNAUTHENTICATED' });
    await login(u); await call('get', '/auth/me', u).expect(200);
  }
});
test('M6 legacy sessions default to zero and persisted revocation survives database reconnect', async () => {
  const u = users[4];
  await db.models.User.updateOne({ _id: u.id }, { $unset: { sessionVersion: 1 } });
  await db.models.Session.updateMany({ userId: u.id }, { $unset: { sessionVersion: 1 } });
  await call('get', '/auth/me', u).expect(200);
  await call('patch', `/admin/users/${u.id}/status`, admin, { status: 'suspended' }).expect(200);
  await call('patch', `/admin/users/${u.id}/status`, admin, { status: 'active' }).expect(200);
  await db.close(); await db.connect(uri);
  await call('get', '/auth/me', u).expect(401);
  await login(u); await call('get', '/auth/me', u).expect(200);
});
test('M6 opposing status races retain a valid account and never restore a pre-suspension cookie', async () => {
  const u = users[5], old = u.cookie, path = `/admin/users/${u.id}/status`;
  const responses = await Promise.all([call('patch', path, admin, { status: 'suspended' }), call('patch', path, admin2, { status: 'active' })]);
  responses.forEach(r => assert.equal(r.status, 200));
  await call('patch', path, admin, { status: 'active' }).expect(200);
  await call('get', '/auth/me', { cookie: old }).expect(401);
  await login(u);
});
test('M6 login crossing suspend/reactivate cannot resurrect a stale session', async () => {
  const u = users[2];
  const service = createAuthService({ config, models: { ...db.models, Session: { create: async value => {
    await call('patch', `/admin/users/${u.id}/status`, admin, { status: 'suspended' }).expect(200);
    await call('patch', `/admin/users/${u.id}/status`, admin, { status: 'active' }).expect(200);
    return db.models.Session.create(value);
  } } } });
  const stale = await service.login({ email: u.email, password });
  await assert.rejects(auth.authenticate(stale.token), { code: 'UNAUTHENTICATED' });
  await login(u);
});
test('M6 two registered pairs complete discovery, consent and notifications with admin metadata privacy', async () => {
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  for (const [c, d, other] of [[users[2], users[3], users[4]], [users[4], users[5], users[2]]]) {
    await call('patch', '/profile', d, { businessName: 'M6 Sample Studio', location: 'Sample City', specialties: ['Formal'], available: true }).expect(200);
    await call('post', '/portfolio', d, { title: 'Sample', category: 'Formal', imageUrl: 'https://example.com/sample.jpg' }).expect(201);
    await call('get', `/designers/${d.id}`).expect(200);
    await call('put', '/measurements', c, { unit: 'cm', values: [{ label: 'Chest', value: 90 }] }).expect(200);
    const r = (await call('post', '/requests', c, { designerId: d.id, outfitType: 'Sample', description: 'Fictional', quantity: 1, desiredCompletionDate: future, budgetAmount: '1000.00', shareMeasurements: true }).expect(201)).body.data.request;
    await call('post', `/requests/${r.id}/messages`, c, { text: 'Private sample' }).expect(201);
    await call('patch', `/requests/${r.id}/decision`, d, { decision: 'accepted', responseText: 'Agreed', priceAmount: '1000.00', completionDate: future }).expect(200);
    await call('patch', `/requests/${r.id}/confirm`, c, {}).expect(200);
    await call('post', `/orders/${r.id}/amendments`, d, { expectedVersion: 0, unit: 'cm', values: [{ label: 'Chest', value: 95 }], explanation: 'Please agree' }).expect(201);
    await call('patch', `/orders/${r.id}/status`, d, { status: 'in_progress' }).expect(409);
    await call('patch', `/orders/${r.id}/amendments/accept`, c, { version: 1 }).expect(200);
    for (const status of ['in_progress', 'ready', 'completed']) await call('patch', `/orders/${r.id}/status`, status === 'completed' ? c : d, { status }).expect(200);
    for (const path of [`/requests/${r.id}`, `/orders/${r.id}`, `/requests/${r.id}/messages`, `/orders/${r.id}/amendments`]) {
      await call('get', path, other).expect(404); await call('get', path, admin).expect(403);
    }
    const detail = (await call('get', `/orders/${r.id}`, c).expect(200)).body.data.order;
    assert.equal(detail.status, 'completed'); assert.equal(detail.effectiveMeasurements.values[0].value, 95);
    await call('get', '/notifications', c).expect(200);
    assert.ok(await db.models.Notification.exists({ requestId: r.id, recipientId: c.id, type: 'order_ready' }));
  }
  for (const kind of ['requests', 'orders']) {
    const result = (await call('get', `/admin/${kind}?limit=50`, admin).expect(200)).body.data;
    assert.ok(result[kind].length > 0);
    for (const row of result[kind]) assert.deepEqual(Object.keys(row).sort(), (kind === 'orders' ? ['customerId', 'designerId', 'id', 'requestId', 'status'] : ['customerId', 'designerId', 'id', 'status']));
  }
});
test('M6 PRD discovery benchmark: 50 fictional designers, ten warm requests under one second', async () => {
  const source = await db.models.User.findById(admin.id).select('+passwordHash');
  const location = 'M6 benchmark ' + suffix;
  for (let i = 0; i < 50; i++) {
    const u = await db.models.User.create({ name: 'Fictional benchmark designer', email: `m6-bench-${i}-${suffix}@example.test`, passwordHash: source.passwordHash, role: 'designer', designer: { businessName: 'Sample Studio', location, specialties: ['Formal'], available: true, portfolio: [{ title: 'Sample', category: 'Formal', imageUrl: 'https://example.com/sample.jpg' }] } });
    ids.push(String(u._id));
  }
  const path = '/designers?limit=50&location=' + encodeURIComponent(location);
  await call('get', path).expect(200);
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    const response = await call('get', path).expect(200);
    times.push(performance.now() - start);
    assert.equal(response.body.data.designers.length, 50);
  }
  console.info('M6 discovery benchmark milliseconds: ' + times.map(n => n.toFixed(2)).join(', '));
  assert.ok(times.every(n => n < 1000));
});
