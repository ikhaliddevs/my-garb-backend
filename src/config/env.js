const dotenv = require('dotenv');
const { createHmac } = require('node:crypto');

function validateEnv(env) {
  const nodeEnv = env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('Invalid NODE_ENV');
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI || '')) throw new Error('Valid MONGODB_URI is required');
  const origins = (env.FRONTEND_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error('FRONTEND_ORIGINS is required');
  for (const origin of origins) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('Invalid FRONTEND_ORIGINS'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) throw new Error('Invalid FRONTEND_ORIGINS');
  }
  if (!/^[a-fA-F0-9]{64}$/.test(env.JWT_SECRET || '')) throw new Error('JWT_SECRET must be 64 hexadecimal characters');
  const sessionTtlSeconds = Number(env.SESSION_TTL_SECONDS || 3600);
  if (!Number.isInteger(sessionTtlSeconds) || sessionTtlSeconds < 300 || sessionTtlSeconds > 86400) throw new Error('Invalid SESSION_TTL_SECONDS');
  if (nodeEnv === 'production' && origins.some(origin => !origin.startsWith('https://'))) throw new Error('Production origins must use HTTPS');
  if (env.EMAIL_PROVIDER === 'mock') throw new Error('Mock email provider is not configurable');
  if (env.EMAIL_PROVIDER && env.EMAIL_PROVIDER !== 'resend') throw new Error('Invalid EMAIL_PROVIDER');
  if (env.EMAIL_PROVIDER === 'resend' && (!env.RESEND_API_KEY || !/^.+<[^<>@\s]+@[^<>@\s]+>$/.test(env.EMAIL_FROM || ''))) {
    throw new Error('Resend email configuration is incomplete');
  }
  if (nodeEnv === 'production' && env.EMAIL_PROVIDER !== 'resend') throw new Error('EMAIL_PROVIDER=resend is required in production');
  if (nodeEnv === 'production' && (!env.RESEND_API_KEY || !/^.+<[^<>@\s]+@[^<>@\s]+>$/.test(env.EMAIL_FROM || ''))) {
    throw new Error('Resend email configuration is required in production');
  }
  if (nodeEnv === 'production' && !/^[a-fA-F0-9]{64}$/.test(env.OTP_HMAC_SECRET || '')) {
    throw new Error('OTP_HMAC_SECRET must be 64 hexadecimal characters in production');
  }
  if (env.OTP_HMAC_SECRET && !/^[a-fA-F0-9]{64}$/.test(env.OTP_HMAC_SECRET)) {
    throw new Error('OTP_HMAC_SECRET must be 64 hexadecimal characters');
  }
  const otpHmacSecret = env.OTP_HMAC_SECRET ||
    (nodeEnv === 'development' ? createHmac('sha256', env.JWT_SECRET).update('mygarb-email-verification-development-key-v1').digest('hex') : null);
  return {
    nodeEnv, port, mongoUri: env.MONGODB_URI, origins, jwtSecret: env.JWT_SECRET, sessionTtlSeconds,
    emailProvider: env.EMAIL_PROVIDER || null,
    resendApiKey: env.RESEND_API_KEY || null,
    emailFrom: env.EMAIL_FROM || null,
    otpHmacSecret,
  };
}

function loadConfig() {
  dotenv.config({ quiet: true });
  return validateEnv(process.env);
}

module.exports = { validateEnv, loadConfig };
