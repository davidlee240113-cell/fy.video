import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analyticsService } from '../services/analytics.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const eventSchema = z.object({
  eventType: z.string(),
  episodeId: z.string().uuid().optional(),
  seriesId: z.string().uuid().optional(),
  data: z.record(z.unknown()),
  sessionId: z.string().optional(),
});

const batchEventSchema = z.object({
  events: z.array(eventSchema).max(100),
});

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  // Ingest events (batch)
  app.post('/v1/analytics/events', async (request, reply) => {
    const { events } = batchEventSchema.parse(request.body);
    await analyticsService.ingestEvents(
      events.map((e) => ({
        ...e,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      })),
    );
    return reply.status(202).send({ accepted: events.length });
  });

  // Update viewer progress (heartbeat)
  app.post('/v1/analytics/progress', { preHandler: [authenticate] }, async (request, reply) => {
    const body = z.object({
      episodeId: z.string().uuid(),
      watchedSeconds: z.number().int().min(0),
      deviceType: z.string().optional(),
    }).parse(request.body);

    await analyticsService.updateViewerProgress(
      request.userId!,
      body.episodeId,
      body.watchedSeconds,
      body.deviceType,
    );
    return reply.send({ success: true });
  });

  // Series analytics
  app.get('/v1/analytics/series/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;
    const data = await analyticsService.getSeriesAnalytics(id, parseInt(query['days'] || '30'));
    return reply.send({ data });
  });

  // Episode analytics
  app.get('/v1/analytics/episodes/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;
    const data = await analyticsService.getEpisodeAnalytics(id, parseInt(query['days'] || '30'));
    return reply.send({ data });
  });

  // Revenue analytics
  app.get('/v1/analytics/revenue', { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const data = await analyticsService.getRevenueAnalytics(
      request.userId!,
      parseInt(query['days'] || '30'),
    );
    return reply.send({ data });
  });
}
