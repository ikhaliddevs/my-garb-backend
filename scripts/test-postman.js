const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const newman = require('newman');
const { createApp } = require('../src/app');
const { createDatabase } = require('../src/config/database');
const { createAuthService } = require('../src/services/auth');

async function main({ m3 = false, m4 = false, m5 = false, m6 = false } = {}) {
  const source = require('../docs/postman/MYGARB_Backend.postman_collection.json');
  // Each milestone gets its own API, cookie jar and unchanged rate-limit budget.
  const collection = m3 ? require('../docs/postman/MYGARB_M3.postman_collection.json') : {
    ...source, item: source.item.filter(item => m6 ? item.name === 'M6 Administration' : m5 ? item.name === 'M5 Conversations and Notifications' : m4 ? item.name === 'M4 Requests and Orders' : !['M4 Requests and Orders', 'M5 Conversations and Notifications', 'M6 Administration'].includes(item.name)),
  };
  const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test';
  if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/mygarb_phasonable_test$/.test(uri)) throw new Error('Unsafe test database');
  const database = createDatabase();
  const suffix = randomBytes(16).toString('hex');
  const emails = (m6 ? ['customer', 'admin'] : m4 || m5 ? ['customer', 'designer', 'other'] : ['customer', 'designer']).map(role => `${role}-${suffix}@example.test`);
  const m6Password = randomBytes(24).toString('hex');
  const config = { nodeEnv: 'test', mongoUri: uri, origins: ['http://localhost:3000'], jwtSecret: randomBytes(32).toString('hex'), sessionTtlSeconds: 3600 };
  let baseUrl, verifiedCodes = 0;
  const emailProvider = {
    async sendVerificationCode({ to, otp }) {
      if (!baseUrl) throw new Error('Test mailbox is unavailable');
      const response = await fetch(`${baseUrl}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-MYGARB-Request': '1' },
        body: JSON.stringify({ email: to, otp }),
      });
      if (!response.ok) throw new Error('Test mailbox verification failed');
      verifiedCodes += 1;
    },
  };
  let server;
  try {
    await database.connect(uri);
    await database.prepareAuth();
    server = createApp({
      config, database, logger: { info() {}, warn() {} }, emailProvider,
      registrationRateLimitMax: 10,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    if (m6) {
      const auth = createAuthService({ models: database.models, config, emailProvider });
      for (const [index, role] of ['customer', 'admin'].entries()) await auth.register({ name: 'M6 fictional runner fixture', email: emails[index], password: m6Password, role });
    }
    const spec = await fetch(`${baseUrl}/docs.json`).then(response => response.json());
    if (spec.info.title !== 'MY GARB PHASONABLE Backend' || spec.info.version !== '0.7.0' || !spec.paths['/api/admin/users']) throw new Error('Unexpected API contract');
    console.info(`Verified local MY GARB API 0.7.0; ${m6 ? 'M6' : m5 ? 'M5' : m4 ? 'M4' : m3 ? 'M3' : 'M1/M2'} collection; isolated test database and fresh in-memory Newman cookie jar.`);
    const values = { baseUrl, customerEmail: emails[0], designerEmail: emails[1], authPassword: randomBytes(24).toString('hex'), fixtureMode: 'runner',
      ...(m6 ? { m6CustomerEmail: emails[0], m6AdminEmail: emails[1], m6Password } : {}),
      ...(m4 ? { m4CustomerEmail: emails[0], m4DesignerEmail: emails[1], m4OtherEmail: emails[2], m4AuthPassword: randomBytes(24).toString('hex') } : {}),
      ...(m5 ? { m5CustomerEmail: emails[0], m5DesignerEmail: emails[1], m5OtherEmail: emails[2], m5AuthPassword: randomBytes(24).toString('hex') } : {}) };
    const summary = await new Promise((resolve, reject) => {
      newman.run({ collection, environment: { values: Object.entries(values).map(([key, value]) => ({ key, value, enabled: true })) },
        reporters: [], timeoutRequest: 10000, timeoutScript: 5000,
      }, (error, result) => error ? reject(error) : resolve(result));
    });
    // Do not print Newman failure objects: they can contain credentials and cookies.
    for (const execution of summary.run.executions) {
      const failed = (execution.assertions || []).filter(assertion => assertion.error).length;
      console.info(`${execution.item.name}: HTTP ${execution.response?.code || 'unavailable'}, ${failed} failed assertions`);
    }
    for (const key of ['requests', 'assertions']) {
      const stat = summary.run.stats[key];
      console.info(`${key}: ${stat.total} total, ${stat.failed} failed`);
    }
    console.info(`Runner failures: ${summary.run.failures.length}`);
    console.info(`OTP verification endpoint calls through test-only mailbox: ${verifiedCodes}`);
    if (summary.run.failures.length) process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    try {
      if (database.isReady()) {
        const users = await database.models.User.find({ email: { $in: emails } }).select('_id');
        const ids = users.map(user => user._id);
        await database.models.Notification.deleteMany({ recipientId: { $in: ids } });
        await database.models.Order.deleteMany({ customerId: { $in: ids } });
        await database.models.Request.deleteMany({ customerId: { $in: ids } });
        const sessions = await database.models.Session.deleteMany({ userId: { $in: ids } });
        const removed = await database.models.User.deleteMany({ _id: { $in: ids }, email: { $in: emails } });
        console.info(`Fixture cleanup: ${removed.deletedCount} users, ${sessions.deletedCount} remaining sessions removed; only this run's records targeted.`);
      }
    } finally { await database.close(); }
  }
}

if (require.main === module) main().then(() => main({ m3: true })).then(() => main({ m4: true })).then(() => main({ m5: true })).then(() => main({ m6: true })).catch(() => {
  console.error('Postman runner failed; check local test MongoDB, dependencies, and collection assertions. Sensitive details suppressed.');
  process.exitCode = 1;
});

module.exports = { main };
