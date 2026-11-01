const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const { createApp } = require('../src/app');
const { errorHandler } = require('../src/middleware/errors');
const { validateEnv } = require('../src/config/env');

const config = { origins: ['http://localhost:3000'] };
const logger = { info() {} };
const app = createApp({ config, database: { isReady: () => false }, logger });

test('liveness succeeds independently of MongoDB with security headers', async () => {
  const response = await request(app).get('/api/health/live').expect(200);
  assert.deepEqual(response.body, { success: true, data: { status: 'alive' } });
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
  assert.ok(response.headers['content-security-policy']);
  assert.equal(response.headers['x-powered-by'], undefined);
  assert.equal(response.headers['cache-control'], 'no-store');
});
test('unavailable database produces safe readiness 503', async () => {
  const response = await request(app).get('/api/health/ready').expect(503);
  assert.deepEqual(response.body, { success: false, error: { code: 'NOT_READY', message: 'Service is not ready' } });
});
test('unknown route returns consistent 404', async () => {
  const response = await request(app).get('/api/unknown').expect(404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});
test('malformed JSON returns 400 without echoing payload', async () => {
  const response = await request(app).post('/api/unknown').set('Content-Type', 'application/json').send('{"secret":').expect(400);
  assert.equal(response.body.error.code, 'INVALID_JSON');
  assert.ok(!response.text.includes('secret'));
});
test('JSON body limit returns 413', async () => {
  const response = await request(app).post('/api/unknown').send({ value: 'a'.repeat(17000) }).expect(413);
  assert.equal(response.body.error.code, 'BODY_TOO_LARGE');
});
test('allowed origin receives exact CORS allowance and preflight', async () => {
  const response = await request(app).get('/api/health/live').set('Origin', config.origins[0]).expect(200);
  assert.equal(response.headers['access-control-allow-origin'], config.origins[0]);
  await request(app).options('/api/health/live').set('Origin', config.origins[0]).set('Access-Control-Request-Method', 'GET').expect(204);
});
test('disallowed and missing origins receive no CORS allowance; CORS is not authentication', async () => {
  for (const origin of ['https://untrusted.example', 'null', '']) {
    const response = await request(app).get('/api/health/live').set('Origin', origin).expect(200);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
  const response = await request(app).options('/api/health/live').set('Origin', 'https://untrusted.example').set('Access-Control-Request-Method', 'GET');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});
test('unexpected errors never expose secrets or stack traces', async () => {
  const failingApp = express();
  failingApp.get('/', () => { throw new Error('mongodb://user:password@private-host secret'); });
  failingApp.use(errorHandler);
  const response = await request(failingApp).get('/').expect(500);
  assert.deepEqual(response.body, { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
});
test('rate limits use JSON and do not prevent health probes', async () => {
  const limited = createApp({ config, database: { isReady: () => false }, logger, rateLimitMax: 1 });
  await request(limited).get('/api/unknown').expect(404);
  const response = await request(limited).get('/api/unknown').expect(429);
  assert.equal(response.body.error.code, 'RATE_LIMITED');
  await request(limited).get('/api/health/live').expect(200);
});
test('logging excludes URL query, authorization, cookies, and payload', async () => {
  const records = [];
  const loggingApp = createApp({ config, database: { isReady: () => false }, logger: { info: record => records.push(record) } });
  await request(loggingApp).post('/api/unknown?token=secret').set('Authorization', 'Bearer secret').set('Cookie', 'session=secret').send({ password: 'secret' }).expect(404);
  assert.equal(records.length, 1);
  assert.deepEqual(Object.keys(records[0]).sort(), ['durationMs', 'method', 'status']);
  assert.ok(!JSON.stringify(records).includes('secret'));
});
test('OpenAPI and Swagger UI are served', async () => {
  const response = await request(app).get('/api/docs.json').expect(200);
  assert.equal(response.body.openapi, '3.0.3');
  assert.deepEqual(Object.keys(response.body.paths).sort(), ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/auth/register', '/api/designers', '/api/designers/{id}', '/api/health/live', '/api/health/ready', '/api/measurements', '/api/orders', '/api/orders/{id}', '/api/orders/{id}/status', '/api/portfolio', '/api/portfolio/{id}', '/api/profile', '/api/requests', '/api/requests/{id}', '/api/requests/{id}/cancel', '/api/requests/{id}/confirm', '/api/requests/{id}/decision']);
  const ui = await request(app).get('/api/docs/').expect(200);
  assert.match(ui.text, /swagger-ui/);
  await request(app).get('/api/docs/swagger-ui-init.js').expect(200);
});
test('configuration rejects invalid values without reflecting secrets', () => {
  const env = { JWT_SECRET: 'a'.repeat(64), MONGODB_URI: 'mongodb://127.0.0.1/test', FRONTEND_ORIGINS: 'http://localhost:3000' };
  assert.equal(validateEnv(env).port, 5000);
  for (const invalid of [{ PORT: '-1' }, { PORT: 'abc' }, { NODE_ENV: 'other' }, { MONGODB_URI: 'secret' }, { FRONTEND_ORIGINS: '*' }, { FRONTEND_ORIGINS: 'http://localhost:3000/path' }]) {
    assert.throws(() => validateEnv({ ...env, ...invalid }), error => !error.message.includes('secret'));
  }
});
