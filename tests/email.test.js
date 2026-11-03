const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEmailProvider } = require('../src/services/email');
const { validateEnv } = require('../src/config/env');

const config = {
  emailProvider: 'resend',
  resendApiKey: 'test-api-key',
  emailFrom: 'MY GARB <noreply@example.test>',
};

test('Resend provider retries transient failures and never returns provider bodies', async () => {
  const statuses = [503, 429, 202];
  const waits = [];
  const requests = [];
  const provider = createEmailProvider(config, async (url, options) => {
    requests.push({ url, options });
    return { ok: statuses.length === 1, status: statuses.shift() };
  }, async delay => waits.push(delay));
  await provider.sendVerificationCode({ to: 'recipient@example.test', otp: '012345' });
  assert.equal(requests.length, 3);
  assert.deepEqual(waits, [100, 200]);
  assert.equal(requests[0].url, 'https://api.resend.com/emails');
  assert.equal(JSON.parse(requests[0].options.body).to[0], 'recipient@example.test');
});

test('Resend provider bounds retries and fails without leaking provider details', async () => {
  let attempts = 0;
  const provider = createEmailProvider(config, async () => {
    attempts += 1;
    return { ok: false, status: 503, text: async () => 'private-provider-response' };
  }, async () => {});
  await assert.rejects(provider.sendVerificationCode({ to: 'recipient@example.test', otp: '012345' }), error => {
    assert.equal(error.message, 'Email provider request failed');
    assert.equal(JSON.stringify(error).includes('private-provider-response'), false);
    return true;
  });
  assert.equal(attempts, 3);
});

test('Resend provider does not retry permanent client errors', async () => {
  let attempts = 0;
  const provider = createEmailProvider(config, async () => {
    attempts += 1;
    return { ok: false, status: 400 };
  }, async () => {});
  await assert.rejects(provider.sendVerificationCode({ to: 'recipient@example.test', otp: '012345' }), /Email provider rejected the request/);
  assert.equal(attempts, 1);
});

test('mock provider cannot be selected by environment and production requires real delivery config', () => {
  const base = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/mygarb_phasonable',
    FRONTEND_ORIGINS: 'https://example.test',
    JWT_SECRET: 'a'.repeat(64),
    OTP_HMAC_SECRET: 'b'.repeat(64),
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'private-test-value',
    EMAIL_FROM: 'MY GARB <noreply@example.test>',
  };
  assert.equal(validateEnv(base).emailProvider, 'resend');
  assert.throws(() => validateEnv({ ...base, EMAIL_PROVIDER: 'mock' }), /Mock email provider is not configurable/);
  assert.throws(() => validateEnv({ ...base, RESEND_API_KEY: '' }), /Resend email configuration is incomplete/);
  assert.throws(() => validateEnv({ ...base, OTP_HMAC_SECRET: '' }), /OTP_HMAC_SECRET must be 64 hexadecimal characters/);
});
