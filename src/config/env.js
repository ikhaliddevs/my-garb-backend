const dotenv = require('dotenv');

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
  return { nodeEnv, port, mongoUri: env.MONGODB_URI, origins, jwtSecret: env.JWT_SECRET, sessionTtlSeconds };
}

function loadConfig() {
  dotenv.config({ quiet: true });
  return validateEnv(process.env);
}

module.exports = { validateEnv, loadConfig };
