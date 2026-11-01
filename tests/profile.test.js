const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const request = require('supertest');
const { createDatabase } = require('../src/config/database');
const { createApp } = require('../src/app');
const { createAuthService } = require('../src/services/auth');

const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test';
if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/mygarb_phasonable_test$/.test(uri)) throw new Error('Unsafe test database');
const suffix = randomBytes(12).toString('hex');
const config = { nodeEnv: 'test', origins: ['http://localhost:3000'], mongoUri: uri, jwtSecret: randomBytes(32).toString('hex'), sessionTtlSeconds: 3600 };
const ids = [];
let database, app, customer, other, designer, designer2, admin;
const portfolio = { title: 'Sample garment', category: 'Formal', imageUrl: 'https://example.com/sample.jpg' };
const details = { businessName: `Studio ${suffix}`, biography: 'Fictional test studio', location: `Sample ${suffix}`, specialties: ['Formal', 'Everyday'], available: true };
const measures = { unit: 'cm', values: [{ label: 'Chest', value: 90 }] };
function call(method, path, user, body, target = app) {
  const req = request(target)[method]('/api' + path);
  if (user) req.set('Cookie', user.cookie);
  if (body !== undefined) req.set('X-MYGARB-Request', '1').send(body);
  return req;
}
async function account(role) {
  const email = `m3-${ids.length}-${suffix}@example.test`;
  // Fixtures are isolated and tracked by ID; create an admin only inside this guarded test DB.
  const user = await database.models.User.create({ name: `Sample ${role}`, email, role, passwordHash: await require('bcrypt').hash('Fixture-only-123!', 12) });
  ids.push(user._id);
  const login = await createAuthService({ config, models: database.models }).login({ email, password: 'Fixture-only-123!' });
  return { id: String(user._id), cookie: `mygarb_session=${login.token}` };
}
before(async () => {
  database = createDatabase();
  await database.connect(uri);
  await database.prepareAuth();
  app = createApp({ config, database, logger: { info() {} }, rateLimitMax: 2000 });
  customer = await account('customer'); other = await account('customer');
  designer = await account('designer'); designer2 = await account('designer'); admin = await account('admin');
});
after(async () => {
  if (!database) return;
  try {
    if (!database.isReady()) await database.connect(uri);
    await database.models.Session.deleteMany({ userId: { $in: ids } });
    await database.models.User.deleteMany({ _id: { $in: ids } });
    assert.equal(await database.models.User.countDocuments({ _id: { $in: ids } }), 0);
    assert.equal(await database.models.Session.countDocuments({ userId: { $in: ids } }), 0);
  } finally { await database.close(); }
});

test('profile ownership, private phone and mass-assignment protection', async () => {
  await call('get', '/profile').expect(401);
  await call('get', '/profile', admin).expect(403);
  await call('patch', '/profile', undefined, { name: 'Sample' }).expect(401);
  await call('patch', '/profile', admin, { name: 'Sample' }).expect(403);
  const updated = await call('patch', '/profile', customer, { name: 'Updated sample', phone: '+1 (202) 555-0100' }).expect(200);
  assert.deepEqual(updated.body.data.profile, { id: customer.id, name: 'Updated sample', phone: '+1 (202) 555-0100' });
  assert.equal((await call('get', '/profile', other).expect(200)).body.data.profile.phone, '');
  for (const input of [{ role: 'admin' }, { email: 'other@example.test' }, { status: 'active' }, { passwordHash: 'x' }, { userId: other.id }, { designer: details }, { name: '' }, { name: 'a'.repeat(101) }, { phone: 'a'.repeat(31) }, { phone: '<script>' }, {}]) {
    await call('patch', '/profile', customer, input).expect(400);
  }
  await call('patch', '/profile', designer, { name: 'Not permitted' }).expect(400);
  await call('get', `/profile?userId=${other.id}`, customer).expect(400);
  await call('get', `/profile/${other.id}`, customer).expect(404);
  const me = await call('get', '/auth/me', customer).expect(200);
  assert.equal(me.body.data.user.name, 'Updated sample');
  assert.equal(me.body.data.user.phone, undefined);
});

test('write CSRF, JSON policy and CORS cover all M3 methods', async () => {
  for (const [method, path, user, body] of [['patch', '/profile', customer, { name: 'Safe' }], ['put', '/measurements', customer, measures], ['post', '/portfolio', designer, portfolio], ['delete', '/portfolio/000000000000000000000000', designer, {}]]) {
    await request(app)[method]('/api' + path).set('Cookie', user.cookie).send(body).expect(403);
    await call(method, path, user, body).set('Origin', 'https://untrusted.example').expect(403);
    await call(method, path, user, body).set('Sec-Fetch-Site', 'cross-site').expect(403);
    await request(app)[method]('/api' + path).set('Cookie', user.cookie).set('X-MYGARB-Request', '1').type('form').send('x=y').expect(415);
    const preflight = await request(app).options('/api' + path).set('Origin', config.origins[0]).set('Access-Control-Request-Method', method.toUpperCase()).expect(204);
    assert.ok(preflight.headers['access-control-allow-methods'].split(',').includes(method.toUpperCase()));
  }
});

test('designer profile bounds, portfolio URL validation, roles and ownership', async () => {
  await call('post', '/portfolio', customer, portfolio).expect(403);
  await call('post', '/portfolio', admin, portfolio).expect(403);
  for (const input of [{ ...portfolio, title: '' }, { ...portfolio, title: 'x'.repeat(101) }, { ...portfolio, category: 'x'.repeat(61) }]) await call('post', '/portfolio', designer, input).expect(400);
  for (const input of [{ available: 'yes' }, { specialties: ['Same', 'same'] }, { specialties: Array(11).fill('a') }, { specialties: [''] }, { biography: 'x'.repeat(2001) }, { businessName: { $ne: '' } }]) await call('patch', '/profile', designer, input).expect(400);
  await call('patch', '/profile', designer, details).expect(200);
  await call('get', '/designers/' + designer.id).expect(404);
  for (const imageUrl of ['javascript:alert(1)', 'data:image/png;base64,x', 'file:///etc/passwd', 'http://example.com/a', 'https://localhost/a', 'https://127.0.0.1/a', 'https://0x7f000001/a', 'https://[::1]/a', 'https://user:pass@example.com/a', 'https://example.com:8443/a', 'https://example.com/a#x', 'https://a.internal/a']) await call('post', '/portfolio', designer, { ...portfolio, imageUrl }).expect(400);
  await call('post', '/portfolio', designer, { ...portfolio, ownerId: other.id }).expect(400);
  const added = await call('post', '/portfolio', designer, portfolio).expect(201);
  const id = added.body.data.entry.id;
  await call('delete', '/portfolio/' + id, designer2, {}).expect(404);
  await call('delete', '/portfolio/' + id, customer, {}).expect(403);
  await call('delete', '/portfolio/invalid', designer, {}).expect(400);
  await call('delete', '/portfolio/' + id, designer, {}).expect(200);
  await call('delete', '/portfolio/' + id, designer, {}).expect(404);
  await call('get', '/designers/' + designer.id).expect(404);
  await call('post', '/portfolio', designer, portfolio).expect(201);
});

test('discovery eligibility, literal search, filters, pagination and public privacy', async () => {
  await call('patch', '/profile', designer2, { ...details, businessName: `Second ${suffix}`, available: false }).expect(200);
  await call('post', '/portfolio', designer2, portfolio).expect(201);
  const list = await call('get', '/designers?q=' + suffix + '&limit=1').expect(200);
  assert.equal(list.body.data.designers.length, 1);
  assert.equal(list.body.data.hasMore, true);
  const second = await call('get', '/designers?q=' + suffix + '&limit=1&page=2').expect(200);
  assert.notEqual(second.body.data.designers[0].id, list.body.data.designers[0].id);
  assert.equal(second.body.data.hasMore, false);
  for (const query of [`q=${suffix}&available=true`, `q=${suffix}&available=false`, `q=Formal&location=${encodeURIComponent(details.location.toLowerCase())}`]) {
    const filtered = await call('get', '/designers?' + query).expect(200);
    assert.ok(filtered.body.data.designers.length > 0);
  }
  assert.equal((await call('get', '/designers?q=' + encodeURIComponent('.*' + suffix)).expect(200)).body.data.designers.length, 0);
  assert.equal((await call('get', '/designers?q=' + suffix + '&page=1000').expect(200)).body.data.designers.length, 0);
  for (const query of ['page=0', 'page=1001', 'limit=51', 'limit=1.5', 'q=a&q=b', 'q[$ne]=x', 'available=1', 'sort=passwordHash', 'location=', 'q=' + 'a'.repeat(101)]) await call('get', '/designers?' + query).expect(400);
  await call('get', '/designers/invalid').expect(400);
  await call('get', '/designers/' + customer.id).expect(404);
  const detail = (await call('get', '/designers/' + designer.id).expect(200)).body.data.designer;
  assert.deepEqual(Object.keys(detail).sort(), ['available', 'biography', 'businessName', 'id', 'location', 'name', 'portfolio', 'specialties']);
  assert.deepEqual(Object.keys(detail.portfolio[0]).sort(), ['category', 'id', 'imageUrl', 'title']);
  for (const [field, value] of [['businessName', ''], ['location', ''], ['specialties', []]]) {
    await call('patch', '/profile', designer, { [field]: value }).expect(200);
    await call('get', '/designers/' + designer.id).expect(404);
    await call('patch', '/profile', designer, { [field]: details[field] }).expect(200);
  }
});

test('measurements are customer-only, isolated, bounded and replaceable', async () => {
  await call('get', '/measurements').expect(401);
  assert.equal((await call('get', '/measurements', customer).expect(200)).body.data.measurements, null);
  for (const user of [designer, admin]) {
    await call('get', '/measurements', user).expect(403);
    await call('put', '/measurements', user, measures).expect(403);
  }
  await call('put', '/measurements', customer, measures).expect(200);
  assert.equal((await call('get', '/measurements', other).expect(200)).body.data.measurements, null);
  await call('get', '/measurements?userId=' + customer.id, other).expect(400);
  await call('get', '/measurements/' + customer.id, designer).expect(404);
  for (const input of [{ ...measures, userId: other.id }, { unit: 'mm', values: [] }, { unit: 'cm', values: Array(51).fill({ label: 'x', value: 1 }) }, ...[0, -1, 1001, '90', null, { $gt: 0 }].map(value => ({ unit: 'cm', values: [{ label: 'Chest', value }] })), { unit: 'cm', values: [{ label: '', value: 1 }] }, { unit: 'cm', values: [{ label: 'Same', value: 1 }, { label: 'same', value: 2 }] }]) await call('put', '/measurements', customer, input).expect(400);
  const replacement = { unit: 'in', values: [{ label: 'Waist', value: 30 }] };
  assert.deepEqual((await call('put', '/measurements', customer, replacement).expect(200)).body.data.measurements.values, replacement.values);
  assert.equal((await database.models.User.findById(customer.id).lean()).measurements, undefined);
  await call('put', '/measurements', customer, { unit: 'cm', values: [] }).expect(200);
  await call('put', '/measurements', customer, measures).expect(200);
});

test('suspension and current role apply to every protected M3 operation and discovery', async () => {
  await database.models.User.updateOne({ _id: designer.id }, { $set: { status: 'suspended' } });
  for (const [method, path, body] of [['get', '/profile'], ['patch', '/profile', details], ['post', '/portfolio', portfolio], ['delete', '/portfolio/000000000000000000000000', {}]]) await call(method, path, designer, body).expect(401);
  await call('get', '/designers/' + designer.id).expect(404);
  const list = await call('get', '/designers?q=' + suffix).expect(200);
  assert.ok(!list.body.data.designers.some(item => item.id === designer.id));
  await database.models.User.updateOne({ _id: designer.id }, { $set: { status: 'active', role: 'customer' } });
  await call('post', '/portfolio', designer, portfolio).expect(403);
  await call('get', '/designers/' + designer.id).expect(404);
  await database.models.User.updateOne({ _id: designer.id }, { $set: { role: 'designer' } });
  await database.models.User.updateOne({ _id: customer.id }, { $set: { status: 'suspended' } });
  await call('get', '/measurements', customer).expect(401);
  await call('put', '/measurements', customer, measures).expect(401);
  await database.models.User.updateOne({ _id: customer.id }, { $set: { status: 'active' } });
});

test('concurrent portfolio additions enforce the 50-entry limit without lost updates', async () => {
  await database.models.User.updateOne({ _id: designer2.id }, { $set: { 'designer.portfolio': Array.from({ length: 49 }, () => ({ ...portfolio })) } });
  const results = await Promise.all([call('post', '/portfolio', designer2, portfolio), call('post', '/portfolio', designer2, portfolio)]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal((await call('get', '/profile', designer2).expect(200)).body.data.profile.portfolio.length, 50);
});

test('profiles, portfolio and measurements survive reconnect and an actual API process restart', { timeout: 30000 }, async () => {
  await database.close();
  database = createDatabase(); await database.connect(uri); await database.prepareAuth();
  app = createApp({ config, database, logger: { info() {} } });
  assert.equal((await call('get', '/profile', customer).expect(200)).body.data.profile.name, 'Updated sample');
  const source = `require('./src/server').startServer({ config: { ...require('./src/config/env').loadConfig(), port: 0 }, logger: { info() {} } }).then(runtime => { process.send(runtime.server.address().port); process.once('message', async () => { await runtime.close(); process.disconnect(); }); }).catch(() => { process.exitCode = 1; process.disconnect(); });`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const child = spawn(process.execPath, ['-e', source], { env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, JWT_SECRET: config.jwtSecret, FRONTEND_ORIGINS: config.origins[0] }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const exited = once(child, 'exit');
    try {
      const port = await Promise.race([once(child, 'message').then(([value]) => value), exited.then(() => { throw new Error('Test API startup failed'); })]);
      const target = `http://127.0.0.1:${port}`;
      assert.equal((await call('get', '/profile', customer, undefined, target).expect(200)).body.data.profile.phone, '+1 (202) 555-0100');
      assert.deepEqual((await call('get', '/measurements', customer, undefined, target).expect(200)).body.data.measurements.values, measures.values);
      assert.equal((await call('get', '/designers/' + designer.id, undefined, undefined, target).expect(200)).body.data.designer.portfolio.length, 1);
    } finally { if (child.exitCode === null) child.send('close'); await exited; }
  }
});

test('50 isolated eligible designers: ten warmed discovery requests each under one second', async t => {
  const location = 'Performance ' + suffix;
  for (let index = 0; index < 50; index++) {
    const user = await database.models.User.create({ name: 'Performance sample', email: `perf-${index}-${suffix}@example.test`, role: 'designer', passwordHash: 'unusable-test-fixture', designer: { ...details, location, portfolio: [portfolio] } });
    ids.push(user._id);
  }
  const path = '/designers?location=' + encodeURIComponent(location) + '&limit=50';
  await call('get', path).expect(200);
  const timings = [];
  for (let index = 0; index < 10; index++) {
    const start = performance.now();
    const response = await call('get', path).expect(200);
    const elapsed = performance.now() - start;
    assert.equal(response.body.data.designers.length, 50);
    assert.ok(elapsed < 1000, 'Discovery exceeded one second');
    timings.push(Math.round(elapsed));
  }
  t.diagnostic('50 designers; ten warmed request durations (ms): ' + timings.join(', '));
});
