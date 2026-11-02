const { loadConfig } = require('../src/config/env');
const { createDatabase } = require('../src/config/database');
const { setupAdmin } = require('../src/services/admin');

async function main() {
  const config = loadConfig();
  // No connection or mutation without an explicit invocation and confirmation.
  if (process.env.ADMIN_SETUP_CONFIRM !== 'create-admin') throw new Error('Admin setup not confirmed');
  const database = createDatabase();
  try {
    await database.connect(config.mongoUri);
    await database.prepareAuth();
    const result = await setupAdmin({ models: database.models, config, env: process.env });
    console.info(result.created ? 'Administrator created' : 'Active administrator already exists; unchanged');
  } finally { await database.close(); }
}

if (require.main === module) main().catch(() => {
  console.error('Admin setup failed: verify explicit confirmation, input, database availability, and existing account role/status');
  process.exitCode = 1;
});

module.exports = { main };
