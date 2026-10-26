const { createApp } = require('./app');
const { loadConfig } = require('./config/env');
const { createDatabase } = require('./config/database');

async function startServer({ config = loadConfig(), database = createDatabase(), logger = console } = {}) {
  await database.connect(config.mongoUri);
  let server;
  try {
    await database.prepareAuth();
    const app = createApp({ config, database, logger });
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port, error => error ? reject(error) : resolve(listener));
      listener.once('error', reject);
    });
  } catch {
    await database.close();
    throw new Error('HTTP server startup failed; check port availability');
  }
  let closing;
  function close() {
    if (!closing) closing = (async () => {
      const timer = setTimeout(() => server.closeAllConnections(), 5000);
      timer.unref();
      try {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      } finally {
        clearTimeout(timer);
        await database.close();
      }
    })();
    return closing;
  }
  return { server, close };
}

if (require.main === module) {
  startServer().then(runtime => {
    console.info('API started');
    const shutdown = () => runtime.close().catch(() => {
      console.error('Shutdown failed');
      process.exitCode = 1;
    });
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }).catch(() => {
    console.error('API startup failed: verify environment, MongoDB availability, and HTTP port');
    process.exitCode = 1;
  });
}

module.exports = { startServer };
