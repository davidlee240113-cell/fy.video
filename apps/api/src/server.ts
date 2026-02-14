import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

import { config } from './config.js';
import { logger } from './lib/logger.js';
import { connectRedis } from './lib/redis.js';
import { errorHandler } from './middleware/error-handler.js';

// Routes
import { authRoutes } from './routes/auth.routes.js';
import { seriesRoutes } from './routes/series.routes.js';
import { episodeRoutes } from './routes/episode.routes.js';
import { purchaseRoutes } from './routes/purchase.routes.js';
import { affiliateRoutes } from './routes/affiliate.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';

async function buildApp() {
  const app = Fastify({
    logger: false, // Using custom pino logger
    requestIdHeader: 'x-correlation-id',
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // ── Plugins ──────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: [config.APP_URL, 'https://fy.video', 'https://*.fy.video'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Managed at CDN level
  });

  await app.register(cookie);

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: '15m' },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'fy.video API',
        description: 'Video Packaging Platform API',
        version: '1.0.0',
      },
      servers: [
        { url: config.API_URL, description: 'Current environment' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
  });

  // ── Error Handler ────────────────────────────────────────────────────────

  app.setErrorHandler(errorHandler);

  // ── Health Check ─────────────────────────────────────────────────────────

  app.get('/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  app.get('/', async () => ({
    name: 'fy.video API',
    version: '1.0.0',
    docs: '/docs',
  }));

  // ── Routes ───────────────────────────────────────────────────────────────

  await app.register(authRoutes);
  await app.register(seriesRoutes);
  await app.register(episodeRoutes);
  await app.register(purchaseRoutes);
  await app.register(affiliateRoutes);
  await app.register(analyticsRoutes);
  await app.register(adminRoutes);
  await app.register(webhookRoutes);

  return app;
}

async function start() {
  try {
    const app = await buildApp();

    // Connect to Redis (non-blocking)
    connectRedis().catch(() => {
      logger.warn('Redis not available — running without cache');
    });

    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(`🎬 fy.video API running on port ${config.PORT}`);
    logger.info(`📚 API docs available at ${config.API_URL}/docs`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

start();

export { buildApp };
