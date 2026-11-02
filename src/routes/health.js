const { Router } = require('express');

function healthRoutes(database) {
  const router = Router();
  router.get('/live', (req, res) => res.json({ success: true, data: { status: 'alive' } }));
  router.get('/ready', (req, res) => {
    if (!database.isReady()) return res.status(503).json({ success: false, error: { code: 'NOT_READY', message: 'Service is not ready' } });
    res.json({ success: true, data: { status: 'ready' } });
  });
  return router;
}

module.exports = { healthRoutes };
