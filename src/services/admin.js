const { validateCredentials } = require('../validators/auth');
const { createAuthService } = require('./auth');
const { HttpError } = require('../middleware/errors');

async function setupAdmin({ models, config, env, emailProvider, logger }) {
  if (env.ADMIN_SETUP_CONFIRM !== 'create-admin') throw new HttpError(400, 'SETUP_NOT_CONFIRMED', 'Explicit admin setup confirmation required');
  const input = validateCredentials({ name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD, role: 'admin' }, true, true);
  const existing = await models.User.findOne({ email: input.email });
  if (existing) {
    if (existing.role !== 'admin' || existing.status !== 'active') throw new HttpError(409, 'ADMIN_SETUP_CONFLICT', 'Existing account cannot be changed by setup');
    return { created: false };
  }
  const result = await createAuthService({ models, config, emailProvider, logger }).register(input);
  if (!result.created) {
    const concurrent = await models.User.findOne({ email: input.email });
    if (concurrent?.role === 'admin' && concurrent.status === 'active') return { created: false };
    throw new HttpError(409, 'ADMIN_SETUP_CONFLICT', 'Existing account cannot be changed by setup');
  }
  return { created: true, deliveryAccepted: result.deliveryAccepted };
}

module.exports = { setupAdmin };
