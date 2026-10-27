const { HttpError } = require('./errors');
const COOKIE_NAME = 'mygarb_session';

function requireAuth(service) {
  return async (req, res, next) => {
    req.auth = await service.authenticate(req.cookies?.[COOKIE_NAME]);
    next();
  };
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    if (!roles.includes(req.auth.user.role)) throw new HttpError(403, 'FORBIDDEN', 'Access denied');
    next();
  };
}

function protectAuthWrites(config) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('Origin');
    // Non-browser clients must also send the custom header. Browsers cannot send
    // it cross-origin without a successful preflight; never infer trust from Host.
    if (req.get('X-MYGARB-Request') !== '1' || (origin !== undefined && !config.origins.includes(origin)) || req.get('Sec-Fetch-Site') === 'cross-site') {
      throw new HttpError(403, 'CSRF_REJECTED', 'Request origin or security header rejected');
    }
    if (!req.is('application/json')) throw new HttpError(415, 'JSON_REQUIRED', 'Content-Type must be application/json');
    next();
  };
}

function cookieOptions(config) {
  return { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'strict', path: '/api' };
}

module.exports = { requireAuth, requireRoles, protectAuthWrites, cookieOptions, COOKIE_NAME };
