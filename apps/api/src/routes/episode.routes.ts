import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { episodeService } from '../services/episode.service.js';
import { purchaseService } from '../services/purchase.service.js';
import { governanceService } from '../services/governance.service.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const createEpisodeSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  episodeNumber: z.number().int().positive().optional(),
  isFree: z.boolean().optional(),
  priceCents: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  releaseDate: z.string().datetime().optional(),
  drmEnabled: z.boolean().optional(),
  thumbnailUrl: z.string().url().optional(),
  captions: z.array(z.object({ lang: z.string(), url: z.string() })).optional(),
  chapters: z.array(z.object({ title: z.string(), startSeconds: z.number() })).optional(),
});

const updateEpisodeSchema = createEpisodeSchema.partial().extend({
  status: z.enum(['processing', 'ready', 'published', 'archived']).optional(),
  videoAssetId: z.string().optional(),
  durationSeconds: z.number().int().optional(),
  resolution: z.string().optional(),
});

export async function episodeRoutes(app: FastifyInstance): Promise<void> {
  // Create episode
  app.post('/v1/series/:id/episodes', { preHandler: [authenticate] }, async (request, reply) => {
    const { id: seriesId } = request.params as { id: string };
    const body = createEpisodeSchema.parse(request.body);
    const episode = await episodeService.create(seriesId, request.userId!, {
      ...body,
      releaseDate: body.releaseDate ? new Date(body.releaseDate) : undefined,
    });
    return reply.status(201).send({ data: episode });
  });

  // List episodes for series
  app.get('/v1/series/:id/episodes', { preHandler: [optionalAuth] }, async (request, reply) => {
    const { id: seriesId } = request.params as { id: string };
    const episodes = await episodeService.listBySeries(seriesId);
    return reply.send({ data: episodes });
  });

  // Get episode details
  app.get('/v1/episodes/:id', { preHandler: [optionalAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await episodeService.getById(id);
    return reply.send({ data: episode });
  });

  // Update episode
  app.patch('/v1/episodes/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateEpisodeSchema.parse(request.body);
    const episode = await episodeService.update(id, request.userId!, body);
    return reply.send({ data: episode });
  });

  // Generate upload URL
  app.post('/v1/episodes/:id/upload-url', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await episodeService.generateUploadUrl(id, request.userId!);
    return reply.send({ data: result });
  });

  // Get signed playback URL
  app.get('/v1/episodes/:id/playback', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await episodeService.getById(id);

    // Check access
    if (!episode.isFree) {
      const hasAccess = await purchaseService.checkAccess(request.userId!, id);
      if (!hasAccess) {
        return reply.status(402).send({ error: { code: 'PAYMENT_REQUIRED', message: 'Purchase required' } });
      }
    }

    // Evaluate access policies
    const policyResult = await governanceService.evaluatePolicies(episode.seriesId, {
      ipAddress: request.ip,
      userId: request.userId,
    });
    if (!policyResult.allowed) {
      return reply.status(403).send({ error: { code: 'POLICY_DENIED', message: policyResult.reason } });
    }

    // Generate signed URL
    const playbackUrl = governanceService.generateSignedPlaybackUrl(
      episode.videoAssetId || episode.id,
      request.userId!,
      request.ip,
      request.id,
    );

    return reply.send({
      data: {
        playbackUrl,
        drmEnabled: episode.drmEnabled,
        captions: episode.captions,
        chapters: episode.chapters,
        durationSeconds: episode.durationSeconds,
      },
    });
  });

  // Get paywall data
  app.get('/v1/episodes/:id/paywall', { preHandler: [optionalAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const paywall = await episodeService.getPaywallData(id, request.userId);
    return reply.send({ data: paywall });
  });

  // Archive episode
  app.delete('/v1/episodes/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await episodeService.archive(id, request.userId!);
    return reply.status(204).send();
  });
}
