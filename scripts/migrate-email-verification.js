const { loadConfig } = require('../src/config/env');
const { createDatabase } = require('../src/config/database');

async function markLegacyAccountsUnverified(User, filter = { emailVerified: { $exists: false } }) {
  return User.updateMany(
    filter,
    { $set: { emailVerified: false, emailVerifiedAt: null } },
  );
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (apply && process.env.EMAIL_VERIFICATION_MIGRATION_CONFIRM !== 'mark-existing-unverified') {
    throw new Error('Explicit migration confirmation required');
  }
  const config = loadConfig();
  const database = createDatabase();
  try {
    await database.connect(config.mongoUri);
    const filter = { emailVerified: { $exists: false } };
    if (!apply) {
      const count = await database.models.User.countDocuments(filter);
      console.info(`Dry run: ${count} legacy accounts would be marked unverified.`);
      return;
    }
    const result = await markLegacyAccountsUnverified(database.models.User);
    console.info(`Migration complete: ${result.modifiedCount} legacy accounts marked unverified.`);
  } finally {
    await database.close();
  }
}

if (require.main === module) main().catch(() => {
  console.error('Email-verification migration failed; no sensitive details were logged.');
  process.exitCode = 1;
});

module.exports = { main, markLegacyAccountsUnverified };
