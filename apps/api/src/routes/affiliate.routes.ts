import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { affiliateService } from '../services/affiliate.service.js';
import { authService } from '../services/auth.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const createLinkSchema = z.object({
  seriesId: z.string().uuid(),
  episodeId: z.string().uuid().optional(),
  customSlug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
});

const instantAffiliateSchema = z.object({
  email: z.string().email(),
  seriesId: z.string().uuid(),
  source: z.enum(['post_episode', 'post_bundle', 'share_button', 'manual', 'api']).optional(),
});

export async function affiliateRoutes(app: FastifyInstance): Promise<void> {
  // Apply to become affiliate
  app.post('/v1/affiliate/apply', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await authService.upgradeToAffiliate(request.userId!);
    return reply.send({ data: { id: user.id, role: user.role, affiliateApprovedAt: user.affiliateApprovedAt } });
  });

  // Create affiliate link
  app.post('/v1/affiliate/links', { preHandler: [requireRole('affiliate', 'creator', 'admin')] }, async (request, reply) => {
    const body = createLinkSchema.parse(request.body);
    const link = await affiliateService.createLink({
      affiliateId: request.userId!,
      seriesId: body.seriesId,
      episodeId: body.episodeId,
      customSlug: body.customSlug,
    });
    return reply.status(201).send({ data: link });
  });

  // Instant affiliate (viewer-to-affiliate conversion)
  app.post('/v1/affiliate/instant', async (request, reply) => {
    const body = instantAffiliateSchema.parse(request.body);
    const result = await affiliateService.instantAffiliate({
      email: body.email,
      seriesId: body.seriesId,
      source: body.source || 'post_episode',
    });

    // Send magic link email for dashboard access
    const magicToken = await authService.createMagicLink(body.email, 'dashboard_access');

    return reply.status(201).send({
      data: {
        affiliateLink: {
          url: result.affiliateLink.destinationUrl,
          trackingCode: result.affiliateLink.trackingCode,
          shortUrl: `https://fy.video/r/${result.affiliateLink.trackingCode}`,
          qrCodeUrl: `https://api.fy.video/qr/${result.affiliateLink.trackingCode}`,
        },
        commission: {
          ratePct: result.commissionRate,
          estimatedPerSaleCents: result.estimatedPerSaleCents,
        },
        dashboard: {
          magicLinkSent: true,
        },
      },
    });
  });

  // List affiliate links
  app.get('/v1/affiliate/links', { preHandler: [requireRole('affiliate', 'creator', 'admin')] }, async (request, reply) => {
    const links = await affiliateService.getAffiliateLinks(request.userId!);
    return reply.send({ data: links });
  });

  // Update affiliate link
  app.patch('/v1/affiliate/links/:id', { preHandler: [requireRole('affiliate', 'creator', 'admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      customSlug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
      status: z.enum(['active', 'paused']).optional(),
    }).parse(request.body);
    const link = await affiliateService.updateLink(id, request.userId!, body);
    return reply.send({ data: link });
  });

  // Get earnings
  app.get('/v1/affiliate/earnings', { preHandler: [requireRole('affiliate', 'creator', 'admin')] }, async (request, reply) => {
    const earnings = await affiliateService.getEarnings(request.userId!);
    return reply.send({ data: earnings });
  });

  // Get full dashboard
  app.get('/v1/affiliate/dashboard', { preHandler: [requireRole('affiliate', 'creator', 'admin')] }, async (request, reply) => {
    const dashboard = await affiliateService.getDashboard(request.userId!);
    return reply.send({ data: dashboard });
  });

  // Record click (internal/system)
  app.post('/v1/affiliate/clicks', async (request, reply) => {
    const body = z.object({
      trackingCode: z.string(),
      referrerUrl: z.string().optional(),
    }).parse(request.body);

    await affiliateService.recordClick(
      body.trackingCode,
      request.ip,
      request.headers['user-agent'] || '',
      body.referrerUrl,
    );
    return reply.send({ success: true });
  });

  // Record share event
  app.post('/v1/affiliate/share', { preHandler: [authenticate] }, async (request, reply) => {
    const body = z.object({
      affiliateLinkId: z.string().uuid(),
      platform: z.string().max(50),
    }).parse(request.body);

    await affiliateService.recordShareEvent(request.userId!, body.affiliateLinkId, body.platform);
    return reply.send({ success: true });
  });
}
