const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const newman = require('newman');
const { createApp } = require('../src/app');
const { createDatabase } = require('../src/config/database');
const collection = require('../docs/postman/MYGARB_Backend.postman_collection.json');

async function main() {
  const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test';
  if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/mygarb_phasonable_test$/.test(uri)) throw new Error('Unsafe test database');
  const database = createDatabase();
  const suffix = randomBytes(16).toString('hex');
  const emails = ['customer', 'designer'].map(role => `${role}-${suffix}@example.test`);
  const config = { nodeEnv: 'test', mongoUri: uri, origins: ['http://localhost:3000'], jwtSecret: randomBytes(32).toString('hex'), sessionTtlSeconds: 3600 };
  let server;
  try {
    await database.connect(uri);
    await database.prepareAuth();
    server = createApp({ config, database, logger: { info() {} } }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const spec = await fetch(`${baseUrl}/docs.json`).then(response => response.json());
    if (spec.info.title !== 'MY GARB PHASONABLE Backend' || spec.info.version !== '0.2.0' || !spec.paths['/api/auth/login']) throw new Error('Unexpected API contract');
    console.info('Verified local MY GARB API 0.2.0; isolated test database and fresh in-memory Newman cookie jar.');
    const values = { baseUrl, customerEmail: emails[0], designerEmail: emails[1], authPassword: randomBytes(24).toString('hex'), fixtureMode: 'runner' };
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
    if (summary.run.failures.length) process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    try {
      if (database.isReady()) {
        const users = await database.models.User.find({ email: { $in: emails } }).select('_id');
        const ids = users.map(user => user._id);
        const sessions = await database.models.Session.deleteMany({ userId: { $in: ids } });
        const removed = await database.models.User.deleteMany({ _id: { $in: ids }, email: { $in: emails } });
        console.info(`Fixture cleanup: ${removed.deletedCount} users, ${sessions.deletedCount} remaining sessions removed; only this run's records targeted.`);
      }
    } finally { await database.close(); }
  }
}

if (require.main === module) main().catch(() => {
  console.error('Postman runner failed; check local test MongoDB, dependencies, and collection assertions. Sensitive details suppressed.');
  process.exitCode = 1;
});

module.exports = { main };
