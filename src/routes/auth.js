const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { createAuthService } = require('../services/auth');
const { validateCredentials } = require('../validators/auth');
const { requireAuth, protectAuthWrites, cookieOptions, COOKIE_NAME } = require('../middleware/auth');

function authRoutes({ config, database, authRateLimitMax = 10 }) {
  const router = Router();
  const service = createAuthService({ config, models: database.models });
  const authenticate = requireAuth(service);
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: authRateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts' } } });
  router.use(protectAuthWrites(config));
  router.post('/register', limiter, async (req, res) => {
    const user = await service.register(validateCredentials(req.body, true));
    res.status(201).json({ success: true, data: { user } });
  });
  router.post('/login', limiter, async (req, res) => {
    const { user, token } = await service.login(validateCredentials(req.body));
    res.cookie(COOKIE_NAME, token, { ...cookieOptions(config), maxAge: config.sessionTtlSeconds * 1000 });
    res.json({ success: true, data: { user } });
  });
  router.get('/me', authenticate, (req, res) => res.json({ success: true, data: { user: req.auth.user } }));
  router.post('/logout', authenticate, async (req, res) => {
    await service.logout(req.auth.sessionId);
    res.clearCookie(COOKIE_NAME, cookieOptions(config));
    res.json({ success: true, data: { message: 'Logged out' } });
  });
  return router;
}

module.exports = { authRoutes };
