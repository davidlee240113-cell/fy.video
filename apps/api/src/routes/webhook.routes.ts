import type { FastifyInstance } from 'fastify';
import { stripe } from '../lib/stripe.js';
import { config } from '../config.js';
import { purchaseService } from '../services/purchase.service.js';
import { episodeService } from '../services/episode.service.js';
import { logger } from '../lib/logger.js';
import type Stripe from 'stripe';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Stripe webhooks — must use raw body for signature verification
  app.post('/webhooks/stripe', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    if (!sig) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;
    try {
      const rawBody = (request as unknown as { rawBody: Buffer }).rawBody;
      event = stripe.webhooks.constructEvent(
        rawBody || JSON.stringify(request.body),
        sig,
        config.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      logger.error({ err }, 'Stripe webhook signature verification failed');
      return reply.status(400).send({ error: 'Webhook signature verification failed' });
    }

    logger.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        try {
          await purchaseService.completePurchase(
            pi.id,
            typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id,
          );
          logger.info({ paymentIntentId: pi.id }, 'Purchase completed via webhook');
        } catch (err) {
          logger.error({ err, paymentIntentId: pi.id }, 'Failed to complete purchase');
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        logger.warn({ paymentIntentId: pi.id, error: pi.last_payment_error?.message }, 'Payment failed');
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        logger.warn({ disputeId: dispute.id, chargeId: dispute.charge }, 'Dispute created');
        // Mark purchase as disputed
        const { prisma } = await import('../lib/prisma.js');
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
        await prisma.purchase.updateMany({
          where: { stripeChargeId: chargeId },
          data: { status: 'disputed' },
        });
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        logger.info({ accountId: account.id }, 'Stripe Connect account updated');
        break;
      }

      default:
        logger.debug({ eventType: event.type }, 'Unhandled Stripe event type');
    }

    return reply.send({ received: true });
  });

  // Cloudflare Stream webhooks
  app.post('/webhooks/cloudflare', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const eventType = body['type'] as string;

    logger.info({ eventType }, 'Cloudflare webhook received');

    switch (eventType) {
      case 'stream.ready': {
        const videoId = (body['video'] as Record<string, string>)?.['uid'];
        const duration = (body['video'] as Record<string, number>)?.['duration'];
        const input = (body['video'] as Record<string, Record<string, unknown>>)?.['input'];
        const width = (input?.['width'] as number) || 0;
        const height = (input?.['height'] as number) || 0;

        if (videoId) {
          // Find episode by videoAssetId and update status
          const { prisma } = await import('../lib/prisma.js');
          const episode = await prisma.episode.findFirst({
            where: { videoAssetId: videoId },
          });

          if (episode) {
            let resolution = '720p';
            if (height >= 2160) resolution = '4K';
            else if (height >= 1080) resolution = '1080p';
            else if (height >= 720) resolution = '720p';
            else resolution = '360p';

            await prisma.episode.update({
              where: { id: episode.id },
              data: {
                status: 'ready',
                durationSeconds: Math.round(duration || 0),
                resolution,
              },
            });

            logger.info({ episodeId: episode.id, videoId }, 'Episode processing complete');
          }
        }
        break;
      }

      case 'stream.error': {
        const videoId = (body['video'] as Record<string, string>)?.['uid'];
        logger.error({ videoId, body }, 'Cloudflare Stream processing error');
        break;
      }
    }

    return reply.send({ received: true });
  });

  // Internal webhooks
  app.post('/webhooks/internal', async (request, reply) => {
    const body = request.body as { event: string; data: Record<string, unknown> };
    logger.info({ event: body.event }, 'Internal webhook received');
    return reply.send({ received: true });
  });
}
