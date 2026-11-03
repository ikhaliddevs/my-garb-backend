const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { createAuthService } = require('../services/auth');
const { validateCredentials, validateVerification } = require('../validators/auth');
const { requireAuth, protectAuthWrites, cookieOptions, COOKIE_NAME } = require('../middleware/auth');

const genericRegistrationResponse = {
  success: true,
  data: { message: 'If this address is eligible, check it for a verification code. Delivery is not confirmed; request a resend if no code arrives.' },
};

function authRoutes({ config, database, logger, emailProvider, authRateLimitMax = 10, registrationRateLimitMax = 5, verificationRateLimitMax = 15 }) {
  const router = Router();
  const service = createAuthService({ config, models: database.models, logger, emailProvider });
  const authenticate = requireAuth(service);
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: authRateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts' } } });
  const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: registrationRateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts' } } });
  const verificationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: verificationRateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts' } } });
  router.use(protectAuthWrites(config));
  router.post('/register', limiter, registrationLimiter, async (req, res) => {
    await service.register(validateCredentials(req.body, true));
    res.status(202).json(genericRegistrationResponse);
  });
  router.post('/login', limiter, async (req, res) => {
    const { user, token } = await service.login(validateCredentials(req.body));
    res.cookie(COOKIE_NAME, token, { ...cookieOptions(config), maxAge: config.sessionTtlSeconds * 1000 });
    res.json({ success: true, data: { user } });
  });
  router.post('/verify-email', verificationLimiter, async (req, res) => {
    const { email, otp } = validateVerification(req.body);
    await service.verifyEmail(email, otp);
    res.json({ success: true, data: { emailVerified: true } });
  });
  router.post('/resend-verification', limiter, registrationLimiter, async (req, res) => {
    await service.resendVerification(validateVerification(req.body, true).email);
    res.status(202).json(genericRegistrationResponse);
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
