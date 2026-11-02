const { Router } = require('express');
const { createAuthService } = require('../services/auth');
const { createOrderService } = require('../services/orders');
const { requireAuth, requireRoles, protectAuthWrites } = require('../middleware/auth');
const { id, object } = require('../validators/profile');
const validate = require('../validators/orders');
function orderRoutes({ config, database }) {
  const router = Router();
  const service = createOrderService(database.models);
  const auth = requireAuth(createAuthService({ config, models: database.models }));
  const member = requireRoles('customer', 'designer');
  const security = protectAuthWrites(config);
  const noQuery = (req, res, next) => { object(req.query, []); next(); };
  const customer = requireRoles('customer');
  const designer = requireRoles('designer');
  router.post('/requests', security, auth, customer, noQuery, async (req, res) => res.status(201).json({ success: true, data: { request: await service.submit(req.auth.user, validate.submission(req.body)) } }));
  for (const [path, orders] of [['requests', false], ['orders', true]]) {
    router.get('/' + path, auth, member, async (req, res) => res.json({ success: true, data: await service.list(req.auth.user, validate.list(req.query, orders), orders) }));
    router.get('/' + path + '/:id', auth, member, noQuery, async (req, res) => res.json({ success: true, data: { [orders ? 'order' : 'request']: await service.detail(req.auth.user, id(req.params.id), orders) } }));
  }
  router.patch('/requests/:id/decision', security, auth, designer, noQuery, async (req, res) => res.json({ success: true, data: { request: await service.decide(req.auth.user, id(req.params.id), validate.decision(req.body)) } }));
  router.patch('/requests/:id/cancel', security, auth, customer, noQuery, async (req, res) => {
    object(req.body, []);
    res.json({ success: true, data: { request: await service.cancel(req.auth.user, id(req.params.id)) } });
  });
  router.patch('/requests/:id/confirm', security, auth, customer, noQuery, async (req, res) => {
    object(req.body, []);
    res.json({ success: true, data: { order: await service.confirm(req.auth.user, id(req.params.id)) } });
  });
  router.patch('/orders/:id/status', security, auth, member, noQuery, async (req, res) => res.json({ success: true, data: { order: await service.transition(req.auth.user, id(req.params.id), validate.status(req.body)) } }));
  return router;
}
module.exports = { orderRoutes };
