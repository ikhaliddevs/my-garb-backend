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
const config = { nodeEnv: 'test', origins: ['http://localhost:3000'], mongoUri: uri, jwtSecret: randomBytes(32).toString('hex'), otpHmacSecret: randomBytes(32).toString('hex'), sessionTtlSeconds: 3600 };
const suffix = randomBytes(12).toString('hex');
const emails = new Set();
const deliveredOtps = new Map();
const deliveryWarnings = [];
const password = 'Test-only-password-123!';
let database, app;
const records = [];
const logger = { info: record => records.push(record), warn: record => deliveryWarnings.push(record) };
const emailProvider = { async sendVerificationCode({ to, otp }) { deliveredOtps.set(to, otp); } };
const payload = (label, role = 'customer') => {
  const email = `${label}-${suffix}@example.test`;
  emails.add(email);
  return { name: 'Test User', email, password, role };
};
const post = (path, body, target = app) => request(target).post('/api/auth/' + path).set('X-MYGARB-Request', '1').send(body);
const cookie = response => response.headers['set-cookie'][0].split(';')[0];
async function verify(email) {
  const otp = deliveredOtps.get(email);
  assert.match(otp || '', /^\d{6}$/);
  await post('verify-email', { email, otp }).expect(200, { success: true, data: { emailVerified: true } });
  deliveredOtps.delete(email);
}
async function account(label, role) {
  const input = payload(label, role);
  const registered = await post('register', input).expect(202);
  assert.deepEqual(registered.body, { success: true, data: { message: 'If this address is eligible, check it for a verification code. Delivery is not confirmed; request a resend if no code arrives.' } });
  const stored = await database.models.User.findOne({ email: input.email });
  assert.ok(stored);
  await verify(input.email);
  const login = await post('login', { email: input.email, password }).expect(200);
  return { input, id: String(stored._id), cookie: cookie(login), login };
}
before(async () => {
  database = createDatabase();
  await database.connect(uri);
  await database.prepareAuth();
  app = createApp({ config, database, logger, emailProvider, rateLimitMax: 1000, authRateLimitMax: 1000, registrationRateLimitMax: 1000, verificationRateLimitMax: 1000 });
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
  await post('register', { ...boundary, password: 'x'.repeat(72) }).expect(202);
  await verify(boundary.email);
  await post('login', { email: boundary.email, password: 'x'.repeat(72) }).expect(200);
  await post('login', { email: boundary.email, password: 'x'.repeat(73) }).expect(400);
});

test('normalized emails and concurrent duplicates create exactly one account', async () => {
  const input = payload('race');
  const responses = await Promise.all([post('register', input), post('register', { ...input, email: '  ' + input.email.toUpperCase() + ' ' })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [202, 202]);
  assert.equal(await database.models.User.countDocuments({ email: input.email }), 1);
  await verify(input.email);
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

test('login rejects unregistered and incorrect credentials without creating users or sessions', async () => {
  const unknown = payload('login-unknown');
  const unknownLogin = await post('login', { email: unknown.email, password }).expect(401);
  assert.equal(unknownLogin.headers['set-cookie'], undefined);
  assert.equal(await database.models.User.countDocuments({ email: unknown.email }), 0);

  const input = payload('login-registered');
  await post('register', input).expect(202);
  const wrongLogin = await post('login', { email: input.email, password: 'Wrong-password-123' }).expect(401);
  assert.equal(wrongLogin.headers['set-cookie'], undefined);
  assert.equal(await database.models.User.countDocuments({ email: input.email }), 1);
  const stored = await database.models.User.findOne({ email: input.email });
  assert.equal(await database.models.Session.countDocuments({ userId: stored._id }), 0);

  await verify(input.email);
  const validLogin = await post('login', { email: input.email, password }).expect(200);
  assert.ok(validLogin.headers['set-cookie']);
  assert.equal(await database.models.User.countDocuments({ email: input.email }), 1);
  assert.equal(await database.models.Session.countDocuments({ userId: stored._id }), 1);
  const me = await request(app).get('/api/auth/me').set('Cookie', cookie(validLogin)).expect(200);
  assert.equal(me.body.data.user.id, String(stored._id));
});

test('registration requires one-time email verification before session creation and protected access', async () => {
  const input = payload('otp-policy');
  const registration = await post('register', input).expect(202);
  assert.deepEqual(registration.body, { success: true, data: { message: 'If this address is eligible, check it for a verification code. Delivery is not confirmed; request a resend if no code arrives.' } });
  assert.equal(registration.headers['set-cookie'], undefined);
  const user = await database.models.User.findOne({ email: input.email });
  assert.equal(user.emailVerified, false);
  assert.equal(user.emailVerifiedAt, null);
  assert.equal(await database.models.Session.countDocuments({ userId: user._id }), 0);

  const jti = randomBytes(32).toString('hex');
  await database.models.Session.create({ tokenHash: createHash('sha256').update(jti).digest('hex'), userId: user._id, sessionVersion: 0, expiresAt: new Date(Date.now() + 3600000) });
  const oldToken = jwt.sign({ sub: String(user._id), jti }, config.jwtSecret, { expiresIn: 3600, issuer: 'mygarb-backend', audience: 'mygarb-session' });
  await request(app).get('/api/auth/me').set('Cookie', `mygarb_session=${oldToken}`).expect(401);
  const blockedLogin = await post('login', { email: input.email, password }).expect(401);
  assert.equal(blockedLogin.headers['set-cookie'], undefined);

  const otp = deliveredOtps.get(input.email);
  const rawUser = await database.models.User.findById(user._id).select('+emailVerification.otpHash +emailVerification.challengeId +emailVerification.expiresAt');
  assert.equal(rawUser.emailVerification.otpHash === otp, false);
  assert.equal(rawUser.emailVerification.challengeId.length, 32);
  assert.ok(rawUser.emailVerification.expiresAt > new Date());
  await verify(input.email);
  const verified = await database.models.User.findById(user._id);
  assert.equal(verified.emailVerified, true);
  assert.ok(verified.emailVerifiedAt instanceof Date);
  assert.equal(verified.sessionVersion, 1);
  await request(app).get('/api/auth/me').set('Cookie', `mygarb_session=${oldToken}`).expect(401);
  await post('verify-email', { email: input.email, otp }).expect(400);
  const login = await post('login', { email: input.email, password }).expect(200);
  await request(app).get('/api/auth/me').set('Cookie', cookie(login)).expect(200);
});

test('verification attempt limit, expiry, replay, resend cooldown and daily cap are enforced', async () => {
  const attempts = payload('otp-attempts');
  await post('register', attempts).expect(202);
  const validOtp = deliveredOtps.get(attempts.email);
  for (let index = 0; index < 5; index += 1) {
    await post('verify-email', { email: attempts.email, otp: '000000' === validOtp ? '000001' : '000000' }).expect(400);
  }
  await post('verify-email', { email: attempts.email, otp: validOtp }).expect(400);
  assert.equal((await database.models.User.findOne({ email: attempts.email })).emailVerified, false);

  const expired = payload('otp-expired');
  await post('register', expired).expect(202);
  await database.models.User.updateOne({ email: expired.email }, { $set: { 'emailVerification.expiresAt': new Date(Date.now() - 1) } });
  await post('verify-email', { email: expired.email, otp: deliveredOtps.get(expired.email) }).expect(400);

  const resend = payload('otp-resend');
  await post('register', resend).expect(202);
  const oldOtp = deliveredOtps.get(resend.email);
  await post('resend-verification', { email: resend.email }).expect(202);
  assert.equal(deliveredOtps.get(resend.email), oldOtp);
  await database.models.User.updateOne({ email: resend.email }, { $set: { 'emailVerification.sentAt': new Date(Date.now() - 61000) } });
  await post('resend-verification', { email: resend.email }).expect(202);
  const newOtp = deliveredOtps.get(resend.email);
  assert.equal((await post('verify-email', { email: resend.email, otp: oldOtp })).status, 400);
  assert.equal((await post('verify-email', { email: resend.email, otp: newOtp })).status, 200);

  const capped = payload('otp-cap');
  await post('register', capped).expect(202);
  const beforeCap = deliveredOtps.get(capped.email);
  await database.models.User.updateOne({ email: capped.email }, { $set: { 'emailVerification.sentAt': new Date(Date.now() - 61000), 'emailVerification.sendCount': 5 } });
  await post('resend-verification', { email: capped.email }).expect(202);
  assert.equal(deliveredOtps.get(capped.email), beforeCap);
});

test('concurrent correct OTP submissions consume the code once', async () => {
  const input = payload('otp-race');
  await post('register', input).expect(202);
  const otp = deliveredOtps.get(input.email);
  const responses = await Promise.all([
    post('verify-email', { email: input.email, otp }),
    post('verify-email', { email: input.email, otp }),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 400]);
  assert.equal(await database.models.User.countDocuments({ email: input.email, emailVerified: true }), 1);
  assert.equal(await database.models.Session.countDocuments({ userId: (await database.models.User.findOne({ email: input.email }))._id }), 0);
});

test('unknown address and delivery failure have the same generic response and do not authenticate', async () => {
  const unknown = await post('resend-verification', { email: payload('otp-unknown').email }).expect(202);
  const failingApp = createApp({
    config,
    database,
    logger,
    emailProvider: { async sendVerificationCode() { throw new Error('private provider response'); } },
    rateLimitMax: 1000,
    authRateLimitMax: 1000,
    registrationRateLimitMax: 1000,
    verificationRateLimitMax: 1000,
  });
  const input = payload('otp-delivery-fail');
  const failure = await post('register', input, failingApp).expect(202);
  assert.deepEqual(failure.body, unknown.body);
  assert.equal(await database.models.User.countDocuments({ email: input.email, emailVerified: false }), 1);
  assert.equal(JSON.stringify(deliveryWarnings).includes('private provider response'), false);
  assert.deepEqual(deliveryWarnings.at(-1), { event: 'verification_email_delivery_failed' });
  await post('login', { email: input.email, password }, failingApp).expect(401);
});

test('legacy accounts without verification fields remain unverified and sessions are rejected', async () => {
  const input = payload('otp-legacy');
  const hash = await bcrypt.hash(password, 12);
  const inserted = await database.models.User.collection.insertOne({
    name: input.name,
    email: input.email,
    passwordHash: hash,
    role: 'customer',
    status: 'active',
    sessionVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const jti = randomBytes(32).toString('hex');
  await database.models.Session.create({ tokenHash: createHash('sha256').update(jti).digest('hex'), userId: inserted.insertedId, sessionVersion: 0, expiresAt: new Date(Date.now() + 3600000) });
  const token = jwt.sign({ sub: String(inserted.insertedId), jti }, config.jwtSecret, { expiresIn: 3600, issuer: 'mygarb-backend', audience: 'mygarb-session' });
  await post('login', { email: input.email, password }).expect(401);
  await request(app).get('/api/auth/me').set('Cookie', `mygarb_session=${token}`).expect(401);
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
  app = createApp({ config, database, logger, emailProvider, rateLimitMax: 1000, authRateLimitMax: 1000, registrationRateLimitMax: 1000, verificationRateLimitMax: 1000 });
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

test('registration IP limit allows five requests per hour and rejects the sixth', async () => {
  const limited = createApp({ config, database, logger, authRateLimitMax: 100, registrationRateLimitMax: 5 });
  for (let index = 0; index < 5; index += 1) await post('register', [], limited).expect(400);
  const response = await post('register', [], limited).expect(429);
  assert.equal(response.body.error.code, 'AUTH_RATE_LIMITED');
});

test('verification IP limit allows fifteen requests per fifteen minutes and rejects the sixteenth', async () => {
  const limited = createApp({ config, database, logger, authRateLimitMax: 100, verificationRateLimitMax: 15 });
  for (let index = 0; index < 15; index += 1) await post('verify-email', [], limited).expect(400);
  const response = await post('verify-email', [], limited).expect(429);
  assert.equal(response.body.error.code, 'AUTH_RATE_LIMITED');
});

test('admin setup requires confirmation, is idempotent, and never promotes existing users', async () => {
  const input = payload('admin');
  const env = { ADMIN_SETUP_CONFIRM: 'create-admin', ADMIN_NAME: input.name, ADMIN_EMAIL: input.email, ADMIN_PASSWORD: password };
  const setup = environment => setupAdmin({ models: database.models, config, env: environment, emailProvider });
  await assert.rejects(setup({ ...env, ADMIN_SETUP_CONFIRM: '' }), { code: 'SETUP_NOT_CONFIRMED' });
  await assert.rejects(setup({ ...env, ADMIN_PASSWORD: 'short' }), { code: 'INVALID_INPUT' });
  assert.deepEqual(await setup(env), { created: true, deliveryAccepted: true });
  const stored = await database.models.User.findOne({ email: input.email }).select('+passwordHash');
  assert.equal((await setup({ ...env, ADMIN_PASSWORD: 'Different-password-123' })).created, false);
  assert.equal((await database.models.User.findById(stored._id).select('+passwordHash')).passwordHash, stored.passwordHash);
  await post('login', { email: input.email, password }).expect(401);
  await verify(input.email);
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
  for (const invalid of [{ JWT_SECRET: '' }, { JWT_SECRET: 'secret' }, { SESSION_TTL_SECONDS: '0' }, { SESSION_TTL_SECONDS: '86401' }, { NODE_ENV: 'production' }, { EMAIL_PROVIDER: 'mock' }, { OTP_HMAC_SECRET: 'short' }]) assert.throws(() => validateEnv({ ...env, ...invalid }));
  const productionEnv = { ...env, NODE_ENV: 'production', FRONTEND_ORIGINS: 'https://example.test', EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'test-key', EMAIL_FROM: 'MY GARB <noreply@example.com>', OTP_HMAC_SECRET: 'b'.repeat(64) };
  assert.equal(validateEnv(productionEnv).nodeEnv, 'production');
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
