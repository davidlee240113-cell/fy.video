import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { seriesService } from '../services/series.service.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';

const createSeriesSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  trailerUrl: z.string().url().optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).optional(),
  fullSeriesPriceCents: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).max(10).optional(),
  affiliateEnabled: z.boolean().optional(),
  affiliateCommissionPct: z.number().min(0).max(50).optional(),
});

const updateSeriesSchema = createSeriesSchema.partial();

export async function seriesRoutes(app: FastifyInstance): Promise<void> {
  // Create series
  app.post('/v1/series', { preHandler: [requireRole('creator', 'admin')] }, async (request, reply) => {
    const body = createSeriesSchema.parse(request.body);
    const series = await seriesService.create(request.userId!, body);
    return reply.status(201).send({ data: series });
  });

  // List series (public)
  app.get('/v1/series', { preHandler: [optionalAuth] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const result = await seriesService.list({
      page: parseInt(query['page'] || '1'),
      limit: parseInt(query['limit'] || '20'),
      category: query['category'],
      search: query['search'],
      creatorId: query['creator_id'],
    });
    return reply.send(result);
  });

  // Get series by slug (public)
  app.get('/v1/series/:slug', { preHandler: [optionalAuth] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const series = await seriesService.getBySlug(slug);
    return reply.send({ data: series });
  });

  // Update series
  app.patch('/v1/series/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSeriesSchema.parse(request.body);
    const series = await seriesService.update(id, request.userId!, body);
    return reply.send({ data: series });
  });

  // Publish series
  app.post('/v1/series/:id/publish', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const series = await seriesService.publish(id, request.userId!);
    return reply.send({ data: series });
  });

  // Archive series
  app.delete('/v1/series/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await seriesService.archive(id, request.userId!);
    return reply.status(204).send();
  });
}
