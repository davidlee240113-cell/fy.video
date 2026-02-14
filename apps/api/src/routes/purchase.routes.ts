import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { purchaseService } from '../services/purchase.service.js';
import { authenticate } from '../middleware/auth.js';

const purchaseSchema = z.object({
  idempotencyKey: z.string().uuid(),
  affiliateCode: z.string().optional(),
});

export async function purchaseRoutes(app: FastifyInstance): Promise<void> {
  // Purchase episode
  app.post('/v1/purchases/episode/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id: episodeId } = request.params as { id: string };
    const body = purchaseSchema.parse(request.body);

    const result = await purchaseService.createEpisodePurchase({
      userId: request.userId!,
      episodeId,
      idempotencyKey: body.idempotencyKey,
      affiliateCode: body.affiliateCode,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({ data: result });
  });

  // Purchase series bundle
  app.post('/v1/purchases/series/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id: seriesId } = request.params as { id: string };
    const body = purchaseSchema.parse(request.body);

    const result = await purchaseService.createSeriesPurchase({
      userId: request.userId!,
      seriesId,
      idempotencyKey: body.idempotencyKey,
      affiliateCode: body.affiliateCode,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({ data: result });
  });

  // List purchases
  app.get('/v1/purchases', { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const result = await purchaseService.getUserPurchases(
      request.userId!,
      parseInt(query['page'] || '1'),
      parseInt(query['limit'] || '20'),
    );
    return reply.send(result);
  });

  // Get purchase details
  app.get('/v1/purchases/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { prisma } = await import('../lib/prisma.js');
    const purchase = await prisma.purchase.findFirst({
      where: { id, userId: request.userId! },
      include: {
        episode: { select: { id: true, title: true, episodeNumber: true } },
        series: { select: { id: true, title: true, slug: true } },
      },
    });
    if (!purchase) {
      return reply.status(404).send({ error: { message: 'Purchase not found' } });
    }
    return reply.send({ data: purchase });
  });

  // Refund
  app.post('/v1/purchases/:id/refund', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const purchase = await purchaseService.refundPurchase(id, request.userId!);
    return reply.send({ data: purchase });
  });

  // Check access to episode
  app.get('/v1/episodes/:id/access', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const hasAccess = await purchaseService.checkAccess(request.userId!, id);
    return reply.send({ data: { hasAccess } });
  });
}
