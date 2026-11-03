const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');
const { createDatabase } = require('../src/config/database');
const { markLegacyAccountsUnverified } = require('../scripts/migrate-email-verification');

const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test';
if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/mygarb_phasonable_test$/.test(uri)) throw new Error('Unsafe test database: local mygarb_phasonable_test required');
const email = `email-migration-${randomBytes(12).toString('hex')}@example.test`;
let database, userId;

before(async () => {
  database = createDatabase();
  await database.connect(uri);
  await database.prepareAuth();
  const result = await database.models.User.collection.insertOne({
    name: 'Fictional legacy fixture',
    email,
    passwordHash: await bcrypt.hash('Migration-fixture-only-password!', 12),
    role: 'customer',
    status: 'active',
    sessionVersion: 0,
    phone: '+123456789',
    measurements: { unit: 'cm', values: [{ label: 'Chest', value: 90 }] },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  userId = result.insertedId;
});

after(async () => {
  if (!database) return;
  try {
    await database.models.User.deleteOne({ _id: userId, email });
  } finally {
    await database.close();
  }
});

test('legacy migration marks only missing verification state and is idempotent', async () => {
  const before = await database.models.User.collection.findOne({ _id: userId });
  const filter = { _id: userId, email, emailVerified: { $exists: false } };
  const first = await markLegacyAccountsUnverified(database.models.User, filter);
  assert.equal(first.modifiedCount, 1);
  const migrated = await database.models.User.collection.findOne({ _id: userId });
  assert.equal(migrated.emailVerified, false);
  assert.equal(migrated.emailVerifiedAt, null);
  assert.equal(migrated.passwordHash, before.passwordHash);
  assert.deepEqual(migrated.measurements, before.measurements);
  assert.equal(migrated.phone, before.phone);
  const second = await markLegacyAccountsUnverified(database.models.User, filter);
  assert.equal(second.modifiedCount, 0);
});
