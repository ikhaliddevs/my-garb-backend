const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const specification = require('./docs/openapi.json');
const { healthRoutes } = require('./routes/health');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp({ config, database, logger = console, rateLimitMax = 100 }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => logger.info({ method: req.method, status: res.statusCode, durationMs: Date.now() - started }));
    next();
  });
  app.use(cors({ origin: (origin, callback) => callback(null, Boolean(origin && config.origins.includes(origin))) }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', rateLimit({
    windowMs: 60 * 1000, limit: rateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false,
    // Probes must remain usable when clients exhaust their API allowance.
    skip: req => ['/health/live', '/health/ready'].includes(req.path),
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/health', healthRoutes(database));
  app.get('/api/docs.json', (req, res) => res.json(specification));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specification));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
