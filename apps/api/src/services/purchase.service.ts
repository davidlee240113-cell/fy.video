import { prisma } from '../lib/prisma.js';
import { stripe } from '../lib/stripe.js';
import { config, PLATFORM_FEE_PCT, DEFAULT_AFFILIATE_COMMISSION_PCT, PURCHASE_COOLDOWN_SECONDS } from '../config.js';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../lib/errors.js';
import type { Purchase } from '@prisma/client';

export interface CreatePurchaseInput {
  userId: string;
  episodeId?: string;
  seriesId?: string;
  idempotencyKey: string;
  affiliateCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class PurchaseService {
  async createEpisodePurchase(input: CreatePurchaseInput): Promise<{ clientSecret: string; purchaseId: string }> {
    if (!input.episodeId) throw new ValidationError('Episode ID required');

    // Check idempotency
    const existing = await prisma.purchase.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { clientSecret: '', purchaseId: existing.id };
    }

    // Cooldown check
    const recentPurchase = await prisma.purchase.findFirst({
      where: {
        userId: input.userId,
        episodeId: input.episodeId,
        createdAt: { gt: new Date(Date.now() - PURCHASE_COOLDOWN_SECONDS * 1000) },
      },
    });
    if (recentPurchase) {
      throw new ConflictError('Purchase cooldown active. Please wait before trying again.');
    }

    // Check if already purchased
    const alreadyPurchased = await prisma.purchase.findFirst({
      where: { userId: input.userId, episodeId: input.episodeId, status: 'completed' },
    });
    if (alreadyPurchased) {
      throw new ConflictError('You already own this episode');
    }

    // Also check if user has a bundle purchase for this series
    const episode = await prisma.episode.findUnique({
      where: { id: input.episodeId },
      include: {
        series: {
          select: {
            id: true,
            creatorId: true,
            affiliateEnabled: true,
            affiliateCommissionPct: true,
          },
        },
      },
    });
    if (!episode) throw new NotFoundError('Episode');
    if (episode.isFree) throw new ValidationError('This episode is free');
    if (!episode.priceCents) throw new ValidationError('Episode has no price set');

    const bundlePurchase = await prisma.purchase.findFirst({
      where: { userId: input.userId, seriesId: episode.seriesId, status: 'completed' },
    });
    if (bundlePurchase) {
      throw new ConflictError('You already own this series');
    }

    // Resolve affiliate
    const affiliate = await this.resolveAffiliate(input.affiliateCode, episode.series);

    // Calculate revenue split
    const amountCents = episode.priceCents;
    const platformFeeCents = Math.round(amountCents * (PLATFORM_FEE_PCT / 100));
    let affiliateCommissionCents = 0;

    if (affiliate) {
      const commissionPct = Number(episode.series.affiliateCommissionPct) || DEFAULT_AFFILIATE_COMMISSION_PCT;
      affiliateCommissionCents = Math.round(amountCents * (commissionPct / 100));
    }

    const creatorPayoutCents = amountCents - platformFeeCents - affiliateCommissionCents;

    // Get creator's Stripe account
    const creator = await prisma.user.findUnique({
      where: { id: episode.series.creatorId },
      select: { stripeAccountId: true },
    });

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: episode.currency.toLowerCase(),
      metadata: {
        episodeId: input.episodeId,
        seriesId: episode.seriesId,
        userId: input.userId,
        affiliateCode: input.affiliateCode || '',
        affiliateId: affiliate?.affiliateId || '',
        type: 'episode_purchase',
      },
      ...(creator?.stripeAccountId && {
        transfer_data: {
          destination: creator.stripeAccountId,
        },
        application_fee_amount: platformFeeCents + affiliateCommissionCents,
      }),
    }, {
      idempotencyKey: input.idempotencyKey,
    });

    // Create purchase record
    const purchase = await prisma.purchase.create({
      data: {
        userId: input.userId,
        episodeId: input.episodeId,
        seriesId: episode.seriesId,
        amountCents,
        currency: episode.currency,
        platformFeeCents,
        creatorPayoutCents,
        affiliateCommissionCents,
        affiliateId: affiliate?.affiliateId,
        affiliateLinkId: affiliate?.linkId,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
        idempotencyKey: input.idempotencyKey,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      purchaseId: purchase.id,
    };
  }

  async createSeriesPurchase(input: CreatePurchaseInput): Promise<{ clientSecret: string; purchaseId: string }> {
    if (!input.seriesId) throw new ValidationError('Series ID required');

    const existing = await prisma.purchase.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { clientSecret: '', purchaseId: existing.id };
    }

    const alreadyPurchased = await prisma.purchase.findFirst({
      where: { userId: input.userId, seriesId: input.seriesId, status: 'completed' },
    });
    if (alreadyPurchased) {
      throw new ConflictError('You already own this series');
    }

    const series = await prisma.series.findUnique({
      where: { id: input.seriesId },
      include: { creator: { select: { stripeAccountId: true } } },
    });
    if (!series) throw new NotFoundError('Series');
    if (!series.fullSeriesPriceCents) throw new ValidationError('Series does not have bundle pricing');

    // Calculate adjusted price (credit prior episode purchases)
    let amountCents = series.fullSeriesPriceCents;
    const priorPurchases = await prisma.purchase.aggregate({
      where: { userId: input.userId, seriesId: input.seriesId, status: 'completed', episodeId: { not: null } },
      _sum: { amountCents: true },
    });
    if (priorPurchases._sum.amountCents) {
      amountCents = Math.max(amountCents - priorPurchases._sum.amountCents, 0);
    }
    // Floor: at least the price of the most expensive remaining episode
    const maxEpisodePrice = await prisma.episode.aggregate({
      where: { seriesId: input.seriesId, isFree: false },
      _max: { priceCents: true },
    });
    if (maxEpisodePrice._max.priceCents) {
      amountCents = Math.max(amountCents, maxEpisodePrice._max.priceCents);
    }

    const affiliate = await this.resolveAffiliate(input.affiliateCode, series);
    const platformFeeCents = Math.round(amountCents * (PLATFORM_FEE_PCT / 100));
    let affiliateCommissionCents = 0;
    if (affiliate) {
      const commissionPct = Number(series.affiliateCommissionPct) || DEFAULT_AFFILIATE_COMMISSION_PCT;
      affiliateCommissionCents = Math.round(amountCents * (commissionPct / 100));
    }
    const creatorPayoutCents = amountCents - platformFeeCents - affiliateCommissionCents;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: series.currency.toLowerCase(),
      metadata: {
        seriesId: input.seriesId,
        userId: input.userId,
        affiliateCode: input.affiliateCode || '',
        affiliateId: affiliate?.affiliateId || '',
        type: 'series_purchase',
      },
      ...(series.creator.stripeAccountId && {
        transfer_data: { destination: series.creator.stripeAccountId },
        application_fee_amount: platformFeeCents + affiliateCommissionCents,
      }),
    }, {
      idempotencyKey: input.idempotencyKey,
    });

    const purchase = await prisma.purchase.create({
      data: {
        userId: input.userId,
        seriesId: input.seriesId,
        amountCents,
        currency: series.currency,
        platformFeeCents,
        creatorPayoutCents,
        affiliateCommissionCents,
        affiliateId: affiliate?.affiliateId,
        affiliateLinkId: affiliate?.linkId,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
        idempotencyKey: input.idempotencyKey,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      purchaseId: purchase.id,
    };
  }

  async completePurchase(stripePaymentIntentId: string, stripeChargeId?: string): Promise<Purchase> {
    const purchase = await prisma.purchase.findFirst({
      where: { stripePaymentIntentId },
    });
    if (!purchase) throw new NotFoundError('Purchase');
    if (purchase.status === 'completed') return purchase;

    const updated = await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: 'completed',
        stripeChargeId,
      },
    });

    // Create affiliate earning if applicable
    if (purchase.affiliateId && purchase.affiliateLinkId && purchase.affiliateCommissionCents > 0) {
      const link = await prisma.affiliateLink.findUnique({
        where: { id: purchase.affiliateLinkId },
      });

      await prisma.affiliateEarning.create({
        data: {
          affiliateId: purchase.affiliateId,
          purchaseId: purchase.id,
          affiliateLinkId: purchase.affiliateLinkId,
          commissionCents: purchase.affiliateCommissionCents,
          commissionRate: link
            ? Number((await prisma.series.findUnique({ where: { id: purchase.seriesId! } }))?.affiliateCommissionPct || DEFAULT_AFFILIATE_COMMISSION_PCT)
            : DEFAULT_AFFILIATE_COMMISSION_PCT,
          status: 'pending',
        },
      });

      // Update affiliate's accrued balance
      await prisma.user.update({
        where: { id: purchase.affiliateId },
        data: { accruedBalanceCents: { increment: purchase.affiliateCommissionCents } },
      });

      // Increment conversion count on the link
      if (purchase.affiliateLinkId) {
        await prisma.affiliateLink.update({
          where: { id: purchase.affiliateLinkId },
          data: { conversionCount: { increment: 1 } },
        });
      }
    }

    return updated;
  }

  async refundPurchase(purchaseId: string, userId: string): Promise<Purchase> {
    const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) throw new NotFoundError('Purchase');
    if (purchase.userId !== userId) throw new ForbiddenError('Not your purchase');
    if (purchase.status !== 'completed') throw new ValidationError('Purchase is not refundable');

    // Process Stripe refund
    if (purchase.stripePaymentIntentId) {
      await stripe.refunds.create({
        payment_intent: purchase.stripePaymentIntentId,
      });
    }

    // Reverse affiliate earning
    if (purchase.affiliateId) {
      await prisma.affiliateEarning.updateMany({
        where: { purchaseId: purchase.id },
        data: { status: 'reversed' },
      });
      await prisma.user.update({
        where: { id: purchase.affiliateId },
        data: { accruedBalanceCents: { decrement: purchase.affiliateCommissionCents } },
      });
    }

    return prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: 'refunded' },
    });
  }

  async getUserPurchases(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where: { userId, status: 'completed' },
        include: {
          episode: { select: { id: true, title: true, thumbnailUrl: true, episodeNumber: true } },
          series: { select: { id: true, title: true, slug: true, thumbnailUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.purchase.count({ where: { userId, status: 'completed' } }),
    ]);

    return { data: purchases, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async checkAccess(userId: string, episodeId: string): Promise<boolean> {
    const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) return false;
    if (episode.isFree) return true;

    const purchase = await prisma.purchase.findFirst({
      where: {
        userId,
        status: 'completed',
        OR: [{ episodeId }, { seriesId: episode.seriesId }],
      },
    });

    return !!purchase;
  }

  private async resolveAffiliate(
    affiliateCode: string | undefined,
    series: { id: string; creatorId: string; affiliateEnabled: boolean },
  ): Promise<{ affiliateId: string; linkId: string } | null> {
    if (!affiliateCode || !series.affiliateEnabled) return null;

    const link = await prisma.affiliateLink.findFirst({
      where: { trackingCode: affiliateCode, seriesId: series.id, status: 'active' },
    });
    if (!link) return null;

    // Block self-referral
    if (link.affiliateId === series.creatorId) return null;

    return { affiliateId: link.affiliateId, linkId: link.id };
  }
}

export const purchaseService = new PurchaseService();
