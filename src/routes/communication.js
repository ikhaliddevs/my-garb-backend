const { Router } = require('express');
const { createAuthService } = require('../services/auth');
const { createCommunicationService } = require('../services/communication');
const { requireAuth, requireRoles, protectAuthWrites } = require('../middleware/auth');
const { id, object } = require('../validators/profile');
const validate = require('../validators/communication');
function communicationRoutes({ config, database }) {
  const router = Router();
  const service = createCommunicationService(database.models);
  const auth = requireAuth(createAuthService({ config, models: database.models }));
  const member = requireRoles('customer', 'designer');
  const security = protectAuthWrites(config);
  const noQuery = (req, res, next) => { object(req.query, []); next(); };
  router.get('/requests/:id/messages', auth, member, async (req, res) => res.json({ success: true, data: await service.messages(req.auth.user, id(req.params.id), validate.pagination(req.query)) }));
  router.post('/requests/:id/messages', security, auth, member, noQuery, async (req, res) => res.status(201).json({ success: true, data: await service.send(req.auth.user, id(req.params.id), validate.message(req.body)) }));
  router.get('/orders/:id/amendments', auth, member, async (req, res) => res.json({ success: true, data: await service.amendments(req.auth.user, id(req.params.id), validate.pagination(req.query)) }));
  router.post('/orders/:id/amendments', security, auth, requireRoles('designer'), noQuery, async (req, res) => res.status(201).json({ success: true, data: { amendment: await service.propose(req.auth.user, id(req.params.id), validate.proposal(req.body)) } }));
  for (const [action, role] of [['accept', 'customer'], ['withdraw', 'designer']]) router.patch('/orders/:id/amendments/' + action, security, auth, requireRoles(role), noQuery, async (req, res) =>
    res.json({ success: true, data: { amendment: await service.agree(req.auth.user, id(req.params.id), validate.agreement(req.body), action === 'withdraw') } }));
  router.get('/notifications', auth, member, async (req, res) => res.json({ success: true, data: await service.notifications(req.auth.user, validate.pagination(req.query)) }));
  router.patch('/notifications/:id/read', security, auth, member, noQuery, async (req, res) => {
    object(req.body, []);
    res.json({ success: true, data: { notification: await service.read(req.auth.user, id(req.params.id)) } });
  });
  return router;
}
module.exports = { communicationRoutes };
