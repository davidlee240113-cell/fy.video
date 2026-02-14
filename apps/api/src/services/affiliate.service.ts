import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
} from '../lib/errors.js';
import { ATTRIBUTION_WINDOW_DAYS, CLICK_DEDUP_SECONDS, DEFAULT_AFFILIATE_COMMISSION_PCT } from '../config.js';
import type { AffiliateLink, AffiliateLinkSource } from '@prisma/client';

export interface CreateLinkInput {
  affiliateId: string;
  seriesId: string;
  episodeId?: string;
  customSlug?: string;
  source?: AffiliateLinkSource;
  createdContext?: Record<string, unknown>;
}

export interface InstantAffiliateInput {
  email: string;
  seriesId: string;
  source: AffiliateLinkSource;
}

export class AffiliateService {
  async createLink(input: CreateLinkInput): Promise<AffiliateLink> {
    const series = await prisma.series.findUnique({ where: { id: input.seriesId } });
    if (!series) throw new NotFoundError('Series');
    if (!series.affiliateEnabled) {
      throw new ForbiddenError('Affiliate links are not enabled for this series');
    }

    // Block self-referral
    if (input.affiliateId === series.creatorId) {
      throw new ForbiddenError('Creators cannot create affiliate links for their own content');
    }

    // Check for existing link
    const existing = await prisma.affiliateLink.findFirst({
      where: {
        affiliateId: input.affiliateId,
        seriesId: input.seriesId,
        episodeId: input.episodeId || null,
        status: 'active',
      },
    });
    if (existing) return existing;

    // Validate custom slug
    if (input.customSlug) {
      const slugTaken = await prisma.affiliateLink.findUnique({
        where: { customSlug: input.customSlug },
      });
      if (slugTaken) throw new ConflictError('Custom slug already taken');
    }

    const trackingCode = nanoid(8).toLowerCase();
    const destinationUrl = `https://fy.video/s/${series.slug}?ref=${trackingCode}`;

    return prisma.affiliateLink.create({
      data: {
        affiliateId: input.affiliateId,
        seriesId: input.seriesId,
        episodeId: input.episodeId,
        trackingCode,
        customSlug: input.customSlug,
        destinationUrl,
        source: input.source || 'manual',
        createdContext: input.createdContext || {},
      },
    });
  }

  async instantAffiliate(input: InstantAffiliateInput): Promise<{
    affiliateLink: AffiliateLink;
    commissionRate: number;
    estimatedPerSaleCents: number;
    isNew: boolean;
  }> {
    const series = await prisma.series.findUnique({ where: { id: input.seriesId } });
    if (!series) throw new NotFoundError('Series');
    if (!series.affiliateEnabled) {
      throw new ForbiddenError('Affiliate links are not enabled for this series');
    }

    const email = input.email.toLowerCase().trim();
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new ValidationError('Invalid email address');
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    let isNew = false;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          role: 'affiliate',
          affiliateApprovedAt: new Date(),
        },
      });
      isNew = true;
    } else if (user.role === 'viewer') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'affiliate', affiliateApprovedAt: new Date() },
      });
    }

    // Block self-referral
    if (user.id === series.creatorId) {
      throw new ForbiddenError('Creators cannot be affiliates for their own content');
    }

    // Create or return existing link
    const affiliateLink = await this.createLink({
      affiliateId: user.id,
      seriesId: input.seriesId,
      source: input.source,
      createdContext: { seriesId: input.seriesId },
    });

    const commissionRate = Number(series.affiliateCommissionPct) || DEFAULT_AFFILIATE_COMMISSION_PCT;
    const estimatedPerSaleCents = series.fullSeriesPriceCents
      ? Math.round(series.fullSeriesPriceCents * (commissionRate / 100))
      : 0;

    return {
      affiliateLink,
      commissionRate,
      estimatedPerSaleCents,
      isNew,
    };
  }

  async recordClick(
    trackingCode: string,
    ipAddress: string,
    userAgent: string,
    referrerUrl?: string,
  ): Promise<void> {
    const link = await prisma.affiliateLink.findFirst({
      where: { trackingCode, status: 'active' },
    });
    if (!link) return;

    // Dedup: same IP + code within 60 seconds
    const dedupKey = `click:${trackingCode}:${ipAddress}`;
    try {
      const isDuplicate = await redis.get(dedupKey);
      if (isDuplicate) return;
      await redis.setex(dedupKey, CLICK_DEDUP_SECONDS, '1');
    } catch {
      // Redis unavailable — skip dedup
    }

    // Increment click count
    await prisma.affiliateLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    });

    // Store attribution in Redis for attribution window
    try {
      const attrKey = `attr:${ipAddress}`;
      await redis.setex(attrKey, ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60, JSON.stringify({
        trackingCode,
        affiliateId: link.affiliateId,
        linkId: link.id,
        timestamp: Date.now(),
      }));
    } catch {
      // Redis unavailable
    }

    // Log analytics event
    await prisma.analyticsEvent.create({
      data: {
        eventType: 'affiliate_click',
        seriesId: link.seriesId,
        episodeId: link.episodeId,
        data: {
          trackingCode,
          affiliateId: link.affiliateId,
          referrerUrl,
          userAgent,
        },
        ipAddress,
        userAgent,
      },
    });
  }

  async getAffiliateLinks(affiliateId: string) {
    return prisma.affiliateLink.findMany({
      where: { affiliateId },
      include: {
        series: { select: { id: true, title: true, slug: true, thumbnailUrl: true } },
        episode: { select: { id: true, title: true, episodeNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateLink(
    linkId: string,
    affiliateId: string,
    data: { customSlug?: string; status?: 'active' | 'paused' },
  ): Promise<AffiliateLink> {
    const link = await prisma.affiliateLink.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundError('Affiliate link');
    if (link.affiliateId !== affiliateId) throw new ForbiddenError('Not your link');

    if (data.customSlug) {
      const slugTaken = await prisma.affiliateLink.findFirst({
        where: { customSlug: data.customSlug, id: { not: linkId } },
      });
      if (slugTaken) throw new ConflictError('Custom slug already taken');
    }

    return prisma.affiliateLink.update({
      where: { id: linkId },
      data: {
        ...(data.customSlug !== undefined && { customSlug: data.customSlug }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  async getEarnings(affiliateId: string) {
    const [earnings, summary] = await Promise.all([
      prisma.affiliateEarning.findMany({
        where: { affiliateId },
        include: {
          purchase: {
            select: { amountCents: true, currency: true, createdAt: true },
          },
          affiliateLink: {
            select: { trackingCode: true, series: { select: { title: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.affiliateEarning.groupBy({
        by: ['status'],
        where: { affiliateId },
        _sum: { commissionCents: true },
        _count: true,
      }),
    ]);

    const allTime = summary.reduce((acc, s) => acc + (s._sum.commissionCents || 0), 0);
    const pending = summary.find((s) => s.status === 'pending')?._sum.commissionCents || 0;
    const paid = summary.find((s) => s.status === 'paid')?._sum.commissionCents || 0;

    return {
      earnings,
      summary: { allTimeCents: allTime, pendingCents: pending, paidCents: paid },
    };
  }

  async getDashboard(affiliateId: string) {
    const [links, earnings, recentClicks, user] = await Promise.all([
      this.getAffiliateLinks(affiliateId),
      this.getEarnings(affiliateId),
      prisma.analyticsEvent.count({
        where: {
          eventType: 'affiliate_click',
          data: { path: ['affiliateId'], equals: affiliateId },
          createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.user.findUnique({
        where: { id: affiliateId },
        select: { accruedBalanceCents: true, payoutThresholdCents: true, stripeAccountId: true },
      }),
    ]);

    return {
      links,
      earnings: earnings.summary,
      recentEarnings: earnings.earnings.slice(0, 20),
      clicks30d: recentClicks,
      balance: {
        accruedCents: user?.accruedBalanceCents || 0,
        thresholdCents: user?.payoutThresholdCents || 2500,
        payoutReady: (user?.accruedBalanceCents || 0) >= (user?.payoutThresholdCents || 2500),
        stripeConnected: !!user?.stripeAccountId,
      },
    };
  }

  async recordShareEvent(
    affiliateId: string,
    affiliateLinkId: string,
    platform: string,
  ): Promise<void> {
    await prisma.shareEvent.create({
      data: { affiliateId, affiliateLinkId, platform },
    });
  }

  async resolveAttribution(
    ipAddress: string,
    cookieRef?: string,
  ): Promise<{ affiliateId: string; linkId: string; trackingCode: string } | null> {
    // Priority 1: Explicit ref parameter (handled at route level)
    // Priority 2: Cookie
    if (cookieRef) {
      const link = await prisma.affiliateLink.findFirst({
        where: { trackingCode: cookieRef, status: 'active' },
      });
      if (link) {
        return { affiliateId: link.affiliateId, linkId: link.id, trackingCode: link.trackingCode };
      }
    }

    // Priority 3: Fingerprint/IP match from Redis
    try {
      const attrData = await redis.get(`attr:${ipAddress}`);
      if (attrData) {
        const attr = JSON.parse(attrData) as {
          trackingCode: string;
          affiliateId: string;
          linkId: string;
        };
        return attr;
      }
    } catch {
      // Redis unavailable
    }

    return null;
  }
}

export const affiliateService = new AffiliateService();
