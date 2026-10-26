const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createDatabase } = require('../src/config/database');
const { createApp } = require('../src/app');
const { createAuthService } = require('../src/services/auth');
const { setupAdmin } = require('../src/services/admin');
const { requireAuth, requireRoles } = require('../src/middleware/auth');
const { errorHandler } = require('../src/middleware/errors');
const { validateEnv } = require('../src/config/env');

const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test';
if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/mygarb_phasonable_test$/.test(uri)) throw new Error('Unsafe test database: local mygarb_phasonable_test required');
const config = { nodeEnv: 'test', origins: ['http://localhost:3000'], mongoUri: uri, jwtSecret: randomBytes(32).toString('hex'), sessionTtlSeconds: 3600 };
const suffix = randomBytes(12).toString('hex');
const emails = new Set();
const password = 'Test-only-password-123!';
let database, app;
const records = [];
const logger = { info: record => records.push(record) };
const payload = (label, role = 'customer') => {
  const email = `${label}-${suffix}@example.test`;
  emails.add(email);
  return { name: 'Test User', email, password, role };
};
const post = (path, body, target = app) => request(target).post('/api/auth/' + path).set('X-MYGARB-Request', '1').send(body);
const cookie = response => response.headers['set-cookie'][0].split(';')[0];
async function account(label, role) {
  const input = payload(label, role);
  const registered = await post('register', input).expect(201);
  const login = await post('login', { email: input.email, password }).expect(200);
  return { input, id: registered.body.data.user.id, cookie: cookie(login), login };
}
before(async () => {
  database = createDatabase();
  await database.connect(uri);
  await database.prepareAuth();
  app = createApp({ config, database, logger, rateLimitMax: 1000, authRateLimitMax: 1000 });
});
after(async () => {
  if (!database) return;
  try {
    if (!database.isReady()) await database.connect(uri);
    const users = await database.models.User.find({ email: { $in: [...emails] } }).select('_id');
    await database.models.Session.deleteMany({ userId: { $in: users.map(user => user._id) } });
    await database.models.User.deleteMany({ _id: { $in: users.map(user => user._id) } });
  } finally { await database.close(); }
});

test('customer and designer registration/login/me expose safe fields and bcrypt hashes', async () => {
  for (const role of ['customer', 'designer']) {
    const item = await account(role, role);
    const stored = await database.models.User.findById(item.id).select('+passwordHash');
    assert.equal(bcrypt.getRounds(stored.passwordHash), 12);
    assert.equal(await bcrypt.compare(password, stored.passwordHash), true);
    const me = await request(app).get('/api/auth/me').set('Cookie', item.cookie).expect(200);
    assert.equal(me.body.data.user.role, role);
    assert.deepEqual(Object.keys(me.body.data.user).sort(), ['email', 'id', 'name', 'role', 'status']);
    assert.ok(!JSON.stringify(me.body).includes(password));
    const session = await database.models.Session.findOne({ userId: item.id });
    assert.equal(session.tokenHash.length, 64);
    assert.ok(!item.cookie.includes(session.tokenHash));
    assert.equal(item.login.headers['cache-control'], 'no-store');
  }
});

test('strict input validation rejects weak/oversized passwords, admin roles and mass assignment', async () => {
  const base = payload('invalid');
  for (const change of [{ password: 'short' }, { password: 'x'.repeat(73) }, { password: '😀'.repeat(19) }, { password: 'abcdefg\0h' }, { role: 'admin' }, { role: 'accountant' }, { status: 'active' }, { passwordHash: 'injected' }, { email: { $ne: null } }, { name: ' ' }, { email: 'invalid' }]) {
    const response = await post('register', { ...base, ...change }).expect(400);
    assert.equal(response.body.error.code, 'INVALID_INPUT');
  }
  await post('register', []).expect(400);
  assert.equal(await database.models.User.countDocuments({ email: base.email }), 0);
  const boundary = payload('boundary');
  await post('register', { ...boundary, password: 'x'.repeat(72) }).expect(201);
  await post('login', { email: boundary.email, password: 'x'.repeat(72) }).expect(200);
  await post('login', { email: boundary.email, password: 'x'.repeat(73) }).expect(400);
});

test('normalized emails and concurrent duplicates create exactly one account', async () => {
  const input = payload('race');
  const responses = await Promise.all([post('register', input), post('register', { ...input, email: '  ' + input.email.toUpperCase() + ' ' })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal(await database.models.User.countDocuments({ email: input.email }), 1);
  await post('login', { email: ' ' + input.email.toUpperCase() + ' ', password }).expect(200);
});

test('wrong, unknown and suspended credentials have identical safe failures', async () => {
  const item = await account('credentials');
  const wrong = await post('login', { email: item.input.email, password: 'Wrong-password-123' }).expect(401);
  const unknown = await post('login', { email: payload('unknown').email, password }).expect(401);
  await database.models.User.updateOne({ _id: item.id }, { $set: { status: 'suspended' } });
  const suspended = await post('login', { email: item.input.email, password }).expect(401);
  assert.deepEqual(wrong.body, unknown.body);
  assert.deepEqual(wrong.body, suspended.body);
  await request(app).get('/api/auth/me').set('Cookie', item.cookie).expect(401);
});

test('logout revokes only the current session, clears cookie and survives reconnection', async () => {
  const item = await account('logout');
  const second = await post('login', { email: item.input.email, password }).expect(200);
  const response = await post('logout', {}).set('Cookie', item.cookie).expect(200);
  assert.match(response.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
  assert.match(response.headers['set-cookie'][0], /Path=\/api/);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  assert.match(response.headers['set-cookie'][0], /SameSite=Strict/);
  await request(app).get('/api/auth/me').set('Cookie', item.cookie).expect(401);
  await database.close();
  database = createDatabase();
  await database.connect(uri);
  await database.prepareAuth();
  app = createApp({ config, database, logger, rateLimitMax: 1000, authRateLimitMax: 1000 });
  await request(app).get('/api/auth/me').set('Cookie', item.cookie).expect(401);
  await request(app).get('/api/auth/me').set('Cookie', cookie(second)).expect(200);
  await post('logout', {}).set('Cookie', item.cookie).expect(401);
});

test('missing, forged, wrong-algorithm, wrong-audience and expired tokens fail', async () => {
  const item = await account('tokens');
  const raw = item.cookie.split('=')[1];
  const claims = jwt.decode(raw);
  const expired = jwt.sign({ sub: claims.sub, jti: claims.jti, exp: 1 }, config.jwtSecret, { algorithm: 'HS256', issuer: 'my-garb-backend', audience: 'my-garb-session' });
  const wrongAlg = jwt.sign(claims, config.jwtSecret, { algorithm: 'HS384' });
  const wrongAudience = jwt.sign({ ...claims, aud: 'other' }, config.jwtSecret);
  const forged = jwt.sign(claims, 'other-key');
  await request(app).get('/api/auth/me').expect(401);
  for (const token of ['invalid', expired, wrongAlg, wrongAudience, forged]) await request(app).get('/api/auth/me').set('Cookie', `mygarb_session=${token}`).expect(401);
  await database.models.Session.updateMany({ userId: item.id }, { $set: { expiresAt: new Date(1) } });
  await request(app).get('/api/auth/me').set('Cookie', item.cookie).expect(401);
});

test('role checks use current database role and reject unauthenticated callers', async () => {
  const item = await account('roles');
  const service = createAuthService({ models: database.models, config });
  const target = express();
  target.use(cookieParser());
  target.get('/admin', requireAuth(service), requireRoles('admin'), (req, res) => res.sendStatus(204));
  target.get('/designer', requireAuth(service), requireRoles('designer'), (req, res) => res.sendStatus(204));
  target.get('/missing-auth', requireRoles('admin'), (req, res) => res.sendStatus(204));
  target.use(errorHandler);
  await request(target).get('/admin').expect(401);
  await request(target).get('/missing-auth').expect(401);
  await request(target).get('/admin').set('Cookie', item.cookie).expect(403);
  await database.models.User.updateOne({ _id: item.id }, { $set: { role: 'designer' } });
  await request(target).get('/designer').set('Cookie', item.cookie).expect(204);
  await request(target).get('/admin').set('Cookie', item.cookie).expect(403);
  await database.models.User.updateOne({ _id: item.id }, { $set: { role: 'admin' } });
  await request(target).get('/admin').set('Cookie', item.cookie).expect(204);
  await database.models.User.updateOne({ _id: item.id }, { $set: { role: 'customer' } });
  await request(target).get('/admin').set('Cookie', item.cookie).expect(403);
});

test('cookie flags, credentialed CORS and CSRF enforce the documented policy', async () => {
  const item = await account('csrf');
  assert.match(item.login.headers['set-cookie'][0], /HttpOnly/);
  assert.match(item.login.headers['set-cookie'][0], /SameSite=Strict/);
  assert.ok(!item.login.headers['set-cookie'][0].includes('Secure'));
  const production = createApp({ config: { ...config, nodeEnv: 'production' }, database, logger });
  const login = await post('login', { email: item.input.email, password }, production).expect(200);
  assert.match(login.headers['set-cookie'][0], /Secure/);
  const logout = await post('logout', {}, production).set('Cookie', cookie(login)).expect(200);
  assert.match(logout.headers['set-cookie'][0], /Secure/);
  await request(app).post('/api/auth/login').send({ email: item.input.email, password }).expect(403);
  for (const origin of ['https://evil.example', 'null']) await post('logout', {}).set('Cookie', item.cookie).set('Origin', origin).expect(403);
  await post('logout', {}).set('Cookie', item.cookie).set('Sec-Fetch-Site', 'cross-site').expect(403);
  await request(app).post('/api/auth/login').set('X-MYGARB-Request', '1').type('form').send({ email: item.input.email, password }).expect(415);
  const preflight = await request(app).options('/api/auth/login').set('Origin', config.origins[0]).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type,x-mygarb-request').expect(204);
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
  assert.equal(preflight.headers['access-control-allow-origin'], config.origins[0]);
  assert.match(preflight.headers['access-control-allow-headers'], /X-MYGARB-Request/);
  await post('logout', {}).set('Cookie', item.cookie).set('Origin', config.origins[0]).expect(200);
});

test('auth rate limits share registration/login budget without blocking health', async () => {
  const limited = createApp({ config, database, logger, authRateLimitMax: 1 });
  await post('login', {}, limited).expect(400);
  const response = await post('register', payload('limited'), limited).expect(429);
  assert.equal(response.body.error.code, 'AUTH_RATE_LIMITED');
  await request(limited).get('/api/health/live').expect(200);
  await request(limited).get('/api/health/ready').expect(200);
});

test('admin setup requires confirmation, is idempotent, and never promotes existing users', async () => {
  const input = payload('admin');
  const env = { ADMIN_SETUP_CONFIRM: 'create-admin', ADMIN_NAME: input.name, ADMIN_EMAIL: input.email, ADMIN_PASSWORD: password };
  const setup = environment => setupAdmin({ models: database.models, config, env: environment });
  await assert.rejects(setup({ ...env, ADMIN_SETUP_CONFIRM: '' }), { code: 'SETUP_NOT_CONFIRMED' });
  await assert.rejects(setup({ ...env, ADMIN_PASSWORD: 'short' }), { code: 'INVALID_INPUT' });
  assert.equal((await setup(env)).created, true);
  const stored = await database.models.User.findOne({ email: input.email }).select('+passwordHash');
  assert.equal((await setup({ ...env, ADMIN_PASSWORD: 'Different-password-123' })).created, false);
  assert.equal((await database.models.User.findById(stored._id).select('+passwordHash')).passwordHash, stored.passwordHash);
  const adminLogin = await post('login', { email: input.email, password }).expect(200);
  assert.equal(adminLogin.body.data.user.role, 'admin');
  const customer = await account('no-promote');
  await assert.rejects(setup({ ...env, ADMIN_EMAIL: customer.input.email }), { code: 'ADMIN_SETUP_CONFLICT' });
  assert.equal((await database.models.User.findById(customer.id)).role, 'customer');
  await database.models.User.updateOne({ _id: stored._id }, { $set: { status: 'suspended' } });
  await assert.rejects(setup(env), { code: 'ADMIN_SETUP_CONFLICT' });
});

test('auth logs contain only metadata; database failure does not expose details', async () => {
  assert.ok(records.length > 0);
  for (const record of records) assert.deepEqual(Object.keys(record).sort(), ['durationMs', 'method', 'status']);
  const failing = { models: { User: { findOne() { throw new Error('private-connection-secret'); } } }, isReady: () => false };
  const target = createApp({ config, database: failing, logger });
  const response = await post('login', { email: payload('failure').email, password }, target).expect(500);
  assert.deepEqual(response.body, { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
});

test('auth configuration fails closed and bounds session duration', () => {
  const env = { MONGODB_URI: uri, FRONTEND_ORIGINS: config.origins[0], JWT_SECRET: config.jwtSecret };
  assert.equal(validateEnv(env).sessionTtlSeconds, 3600);
  for (const invalid of [{ JWT_SECRET: '' }, { JWT_SECRET: 'secret' }, { SESSION_TTL_SECONDS: '0' }, { SESSION_TTL_SECONDS: '86401' }, { NODE_ENV: 'production' }]) assert.throws(() => validateEnv({ ...env, ...invalid }));
  assert.equal(validateEnv({ ...env, NODE_ENV: 'production', FRONTEND_ORIGINS: 'https://example.test' }).nodeEnv, 'production');
});

test('deleting an account invalidates its still-signed session', async () => {
  const item = await account('deleted');
  await database.models.User.deleteOne({ _id: item.id });
  try { await request(app).get('/api/auth/me').set('Cookie', item.cookie).expect(401); }
  finally { await database.models.Session.deleteMany({ userId: item.id }); }
});

test('unregistered session identifier cannot be used despite valid signature', async () => {
  const item = await account('no-session');
  const jti = randomBytes(32).toString('hex');
  const token = jwt.sign({ sub: item.id, jti }, config.jwtSecret, { expiresIn: 3600, issuer: 'my-garb-backend', audience: 'my-garb-session' });
  assert.equal(await database.models.Session.countDocuments({ tokenHash: createHash('sha256').update(jti).digest('hex') }), 0);
  await request(app).get('/api/auth/me').set('Cookie', `mygarb_session=${token}`).expect(401);
});

test('logout remains revoked after an actual API process restart', { timeout: 30000 }, async () => {
  const item = await account('process-restart');
  const source = `
    const { startServer } = require('./src/server');
    const { loadConfig } = require('./src/config/env');
    startServer({ config: { ...loadConfig(), port: 0 }, logger: { info() {} } }).then(runtime => {
      process.send({ port: runtime.server.address().port });
      process.once('message', async () => { await runtime.close(); process.disconnect(); });
    }).catch(() => { process.exitCode = 1; process.disconnect(); });
  `;
  async function launch() {
    const child = spawn(process.execPath, ['-e', source], { env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, JWT_SECRET: config.jwtSecret, FRONTEND_ORIGINS: config.origins[0] }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const exited = once(child, 'exit');
    const address = await Promise.race([once(child, 'message').then(([message]) => message), exited.then(() => { throw new Error('Test API exited before startup'); })]);
    return { child, exited, url: `http://127.0.0.1:${address.port}` };
  }
  let runtime;
  try {
    runtime = await launch();
    await request(runtime.url).get('/api/auth/me').set('Cookie', item.cookie).expect(200);
    await post('logout', {}, runtime.url).set('Cookie', item.cookie).expect(200);
    runtime.child.send('close');
    assert.equal((await runtime.exited)[0], 0);
    runtime = await launch();
    await request(runtime.url).get('/api/auth/me').set('Cookie', item.cookie).expect(401);
    await request(runtime.url).get('/api/health/ready').expect(200);
  } finally {
    if (runtime && runtime.child.exitCode === null) {
      runtime.child.send('close');
      await runtime.exited;
    }
  }
});
