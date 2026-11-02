const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createDatabase } = require('../src/config/database');
const { createApp } = require('../src/app');
const { startServer } = require('../src/server');

const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test';
// Fail closed before connecting. Tests never write or drop collections/databases.
if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/mygarb_phasonable_test$/.test(uri)) {
  throw new Error('TEST_MONGODB_URI must target local mygarb_phasonable_test with an explicit port');
}
const config = { origins: ['http://localhost:3000'], mongoUri: uri, port: 0 };
const logger = { info() {} };

test('real MongoDB connection enables readiness; disconnect disables it', async () => {
  const database = createDatabase();
  try {
    await database.connect(uri);
    assert.equal(database.isReady(), true);
    const app = createApp({ config, database, logger });
    const response = await request(app).get('/api/health/ready').expect(200);
    assert.deepEqual(response.body, { success: true, data: { status: 'ready' } });
    await database.close();
    await request(app).get('/api/health/ready').expect(503);
    await request(app).get('/api/health/live').expect(200);
  } finally { await database.close(); }
});
test('connection failure is bounded and sanitizes URI details', async () => {
  const database = createDatabase();
  try {
    await assert.rejects(database.connect('mongodb://127.0.0.1:1/mygarb_phasonable_test'), { message: 'MongoDB connection failed; check database service and configuration' });
    assert.equal(database.isReady(), false);
  } finally { await database.close(); }
});
test('real HTTP server closes idempotently with its database', async () => {
  const database = createDatabase();
  const runtime = await startServer({ config, database, logger });
  try {
    await request(runtime.server).get('/api/health/ready').expect(200);
    await Promise.all([runtime.close(), runtime.close()]);
    assert.equal(runtime.server.listening, false);
    assert.equal(database.isReady(), false);
  } finally { await runtime.close(); }
});
test('occupied port closes newly opened database after startup failure', async () => {
  const first = await startServer({ config, logger });
  const database = createDatabase();
  try {
    await assert.rejects(startServer({ config: { ...config, port: first.server.address().port }, database, logger }), { message: 'HTTP server startup failed; check port availability' });
    assert.equal(database.isReady(), false);
  } finally { await first.close(); await database.close(); }
});
