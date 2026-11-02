const { Router } = require('express');
const { createAuthService } = require('../services/auth');
const { createAdministrationService } = require('../services/administration');
const { requireAuth, requireRoles, protectAuthWrites } = require('../middleware/auth');
const { id, object } = require('../validators/profile');
const validate = require('../validators/admin');
function adminRoutes({ config, database }) {
  const router = Router();
  const service = createAdministrationService(database.models);
  router.use(protectAuthWrites(config), requireAuth(createAuthService({ config, models: database.models })), requireRoles('admin'));
  for (const kind of ['users', 'requests', 'orders']) router.get('/' + kind, async (req, res) => res.json({ success: true, data: await service.list(kind, validate.list(req.query)) }));
  router.patch('/users/:id/status', async (req, res) => {
    object(req.query, []);
    res.json({ success: true, data: { user: await service.changeStatus(id(req.params.id), validate.status(req.body)) } });
  });
  return router;
}
module.exports = { adminRoutes };
