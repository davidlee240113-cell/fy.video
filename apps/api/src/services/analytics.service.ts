import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export interface AnalyticsEventInput {
  eventType: string;
  userId?: string;
  episodeId?: string;
  seriesId?: string;
  data: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export class AnalyticsService {
  async ingestEvents(events: AnalyticsEventInput[]): Promise<void> {
    await prisma.analyticsEvent.createMany({
      data: events.map((e) => ({
        eventType: e.eventType,
        userId: e.userId,
        episodeId: e.episodeId,
        seriesId: e.seriesId,
        data: e.data,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
        sessionId: e.sessionId,
      })),
    });
  }

  async updateViewerProgress(
    userId: string,
    episodeId: string,
    watchedSeconds: number,
    deviceType?: string,
  ): Promise<void> {
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      select: { durationSeconds: true },
    });

    const completed = episode?.durationSeconds
      ? watchedSeconds >= episode.durationSeconds * 0.9
      : false;

    await prisma.viewerProgress.upsert({
      where: { userId_episodeId: { userId, episodeId } },
      create: {
        userId,
        episodeId,
        watchedSeconds,
        totalWatchTime: watchedSeconds,
        completed,
        completedAt: completed ? new Date() : null,
        deviceType,
        lastWatchedAt: new Date(),
      },
      update: {
        watchedSeconds,
        totalWatchTime: { increment: 15 }, // Heartbeat interval
        ...(completed && {
          completed: true,
          completedAt: new Date(),
        }),
        deviceType,
        lastWatchedAt: new Date(),
      },
    });
  }

  async getSeriesAnalytics(seriesId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalViews,
      uniqueViewers,
      completions,
      revenue,
      recentPurchases,
      episodeStats,
    ] = await Promise.all([
      prisma.analyticsEvent.count({
        where: { seriesId, eventType: 'play_start', createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { seriesId, eventType: 'play_start', createdAt: { gte: since }, userId: { not: null } },
      }),
      prisma.viewerProgress.count({
        where: {
          episode: { seriesId },
          completed: true,
          completedAt: { gte: since },
        },
      }),
      prisma.purchase.aggregate({
        where: { seriesId, status: 'completed', createdAt: { gte: since } },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.purchase.findMany({
        where: { seriesId, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amountCents: true,
          currency: true,
          createdAt: true,
          affiliateId: true,
          episode: { select: { title: true, episodeNumber: true } },
        },
      }),
      prisma.episode.findMany({
        where: { seriesId },
        select: {
          id: true,
          title: true,
          episodeNumber: true,
          _count: {
            select: {
              purchases: { where: { status: 'completed' } },
              viewerProgress: { where: { completed: true } },
            },
          },
        },
        orderBy: { episodeNumber: 'asc' },
      }),
    ]);

    return {
      overview: {
        totalViews,
        uniqueViewers: uniqueViewers.length,
        completions,
        revenueCents: revenue._sum.amountCents || 0,
        purchaseCount: revenue._count,
      },
      recentPurchases,
      episodeStats,
      period: { days, since: since.toISOString() },
    };
  }

  async getEpisodeAnalytics(episodeId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [views, completions, revenue, avgWatchTime, paywallImpressions, paywallConversions] =
      await Promise.all([
        prisma.analyticsEvent.count({
          where: { episodeId, eventType: 'play_start', createdAt: { gte: since } },
        }),
        prisma.viewerProgress.count({
          where: { episodeId, completed: true, completedAt: { gte: since } },
        }),
        prisma.purchase.aggregate({
          where: { episodeId, status: 'completed', createdAt: { gte: since } },
          _sum: { amountCents: true },
          _count: true,
        }),
        prisma.viewerProgress.aggregate({
          where: { episodeId },
          _avg: { totalWatchTime: true },
        }),
        prisma.analyticsEvent.count({
          where: { episodeId, eventType: 'paywall_impression', createdAt: { gte: since } },
        }),
        prisma.analyticsEvent.count({
          where: { episodeId, eventType: 'paywall_conversion', createdAt: { gte: since } },
        }),
      ]);

    return {
      views,
      completions,
      completionRate: views > 0 ? Math.round((completions / views) * 100) : 0,
      revenueCents: revenue._sum.amountCents || 0,
      purchaseCount: revenue._count,
      avgWatchTimeSeconds: Math.round(avgWatchTime._avg.totalWatchTime || 0),
      paywallImpressions,
      paywallConversions,
      paywallConversionRate:
        paywallImpressions > 0 ? Math.round((paywallConversions / paywallImpressions) * 100) : 0,
      period: { days, since: since.toISOString() },
    };
  }

  async getRevenueAnalytics(creatorId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [total, byDay, bySeries, affiliateRevenue] = await Promise.all([
      prisma.purchase.aggregate({
        where: {
          series: { creatorId },
          status: 'completed',
          createdAt: { gte: since },
        },
        _sum: { amountCents: true, creatorPayoutCents: true, affiliateCommissionCents: true, platformFeeCents: true },
        _count: true,
      }),
      prisma.$queryRaw`
        SELECT DATE(created_at) as date, SUM(amount_cents) as revenue, COUNT(*) as count
        FROM purchases p
        JOIN series s ON p.series_id = s.id
        WHERE s.creator_id = ${creatorId}::uuid
          AND p.status = 'completed'
          AND p.created_at >= ${since}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      prisma.purchase.groupBy({
        by: ['seriesId'],
        where: { series: { creatorId }, status: 'completed', createdAt: { gte: since } },
        _sum: { amountCents: true },
        _count: true,
        orderBy: { _sum: { amountCents: 'desc' } },
      }),
      prisma.purchase.aggregate({
        where: {
          series: { creatorId },
          status: 'completed',
          createdAt: { gte: since },
          affiliateId: { not: null },
        },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]);

    return {
      total: {
        revenueCents: total._sum.amountCents || 0,
        payoutCents: total._sum.creatorPayoutCents || 0,
        affiliateCommissionCents: total._sum.affiliateCommissionCents || 0,
        platformFeeCents: total._sum.platformFeeCents || 0,
        purchaseCount: total._count,
      },
      byDay,
      bySeries,
      affiliateContribution: {
        revenueCents: affiliateRevenue._sum.amountCents || 0,
        purchaseCount: affiliateRevenue._count,
        pctOfTotal:
          total._count > 0 ? Math.round((affiliateRevenue._count / total._count) * 100) : 0,
      },
      period: { days, since: since.toISOString() },
    };
  }
}

export const analyticsService = new AnalyticsService();
