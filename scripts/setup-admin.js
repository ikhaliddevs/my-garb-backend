const { loadConfig } = require('../src/config/env');
const { createDatabase } = require('../src/config/database');
const { setupAdmin } = require('../src/services/admin');
const { createEmailProvider } = require('../src/services/email');

async function main() {
  const config = loadConfig();
  // No connection or mutation without an explicit invocation and confirmation.
  if (process.env.ADMIN_SETUP_CONFIRM !== 'create-admin') throw new Error('Admin setup not confirmed');
  const database = createDatabase();
  try {
    await database.connect(config.mongoUri);
    await database.prepareAuth();
    const result = await setupAdmin({ models: database.models, config, env: process.env, emailProvider: createEmailProvider(config) });
    if (!result.created) {
      console.info('Active administrator already exists; unchanged');
    } else if (result.deliveryAccepted) {
      console.info('Unverified administrator created; email provider accepted the verification message. Verify the mailbox before login.');
    } else {
      console.info('Unverified administrator created; email delivery was not confirmed. Configure the provider or wait before requesting another code.');
    }
  } finally { await database.close(); }
}

if (require.main === module) main().catch(() => {
  console.error('Admin setup failed: verify explicit confirmation, input, database availability, and existing account role/status');
  process.exitCode = 1;
});

module.exports = { main };
