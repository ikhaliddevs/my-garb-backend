const { Router } = require('express');
const { createAuthService } = require('../services/auth');
const { createProfileService } = require('../services/profile');
const { requireAuth, requireRoles, protectAuthWrites } = require('../middleware/auth');
const validate = require('../validators/profile');

function profileRoutes({ config, database }) {
  const router = Router();
  const service = createProfileService(database.models);
  const auth = requireAuth(createAuthService({ config, models: database.models }));
  const members = requireRoles('customer', 'designer');
  const designer = requireRoles('designer');
  const customer = requireRoles('customer');
  const security = protectAuthWrites(config);
  const noQuery = (req, res, next) => { validate.object(req.query, []); next(); };
  router.get('/designers', async (req, res) => res.json({ success: true, data: await service.list(validate.discovery(req.query)) }));
  router.get('/designers/:id', noQuery, async (req, res) => res.json({ success: true, data: { designer: await service.detail(validate.id(req.params.id)) } }));
  router.get('/profile', auth, members, noQuery, async (req, res) => res.json({ success: true, data: { profile: await service.get(req.auth.user) } }));
  router.patch('/profile', security, auth, members, noQuery, async (req, res) => res.json({ success: true, data: { profile: await service.patch(req.auth.user, validate.profile(req.body, req.auth.user.role)) } }));
  router.post('/portfolio', security, auth, designer, noQuery, async (req, res) => res.status(201).json({ success: true, data: { entry: await service.addPortfolio(req.auth.user, validate.portfolio(req.body)) } }));
  router.delete('/portfolio/:id', security, auth, designer, noQuery, async (req, res) => {
    validate.object(req.body, []);
    await service.deletePortfolio(req.auth.user, validate.id(req.params.id));
    res.json({ success: true, data: { message: 'Portfolio entry deleted' } });
  });
  router.get('/measurements', auth, customer, noQuery, async (req, res) => res.json({ success: true, data: { measurements: await service.getMeasurements(req.auth.user) } }));
  router.put('/measurements', security, auth, customer, noQuery, async (req, res) => res.json({ success: true, data: { measurements: await service.putMeasurements(req.auth.user, validate.measurements(req.body)) } }));
  return router;
}
module.exports = { profileRoutes };
