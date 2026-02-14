import { prisma } from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js';
import type { Episode, EpisodeStatus, Prisma } from '@prisma/client';

export interface CreateEpisodeInput {
  title: string;
  description?: string;
  episodeNumber?: number;
  isFree?: boolean;
  priceCents?: number;
  currency?: string;
  releaseDate?: Date;
  drmEnabled?: boolean;
  thumbnailUrl?: string;
  captions?: Array<{ lang: string; url: string }>;
  chapters?: Array<{ title: string; startSeconds: number }>;
}

export interface UpdateEpisodeInput extends Partial<CreateEpisodeInput> {
  status?: EpisodeStatus;
  videoAssetId?: string;
  sourceFileUrl?: string;
  durationSeconds?: number;
  resolution?: string;
}

export class EpisodeService {
  async create(seriesId: string, creatorId: string, input: CreateEpisodeInput): Promise<Episode> {
    const series = await prisma.series.findUnique({ where: { id: seriesId } });
    if (!series) throw new NotFoundError('Series');
    if (series.creatorId !== creatorId) {
      throw new ForbiddenError('You can only add episodes to your own series');
    }

    // Auto-increment episode number if not provided
    let episodeNumber = input.episodeNumber;
    if (!episodeNumber) {
      const lastEpisode = await prisma.episode.findFirst({
        where: { seriesId },
        orderBy: { episodeNumber: 'desc' },
      });
      episodeNumber = (lastEpisode?.episodeNumber ?? 0) + 1;
    }

    return prisma.episode.create({
      data: {
        seriesId,
        episodeNumber,
        title: input.title,
        description: input.description,
        isFree: input.isFree ?? false,
        priceCents: input.priceCents,
        currency: input.currency || 'USD',
        releaseDate: input.releaseDate,
        drmEnabled: input.drmEnabled ?? false,
        thumbnailUrl: input.thumbnailUrl,
        captions: input.captions || [],
        chapters: input.chapters || [],
        status: 'uploading',
      },
    });
  }

  async getById(id: string): Promise<Episode> {
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: { series: { select: { creatorId: true, slug: true, title: true, affiliateCommissionPct: true } } },
    });
    if (!episode) throw new NotFoundError('Episode');
    return episode;
  }

  async listBySeries(seriesId: string, includeUnpublished = false) {
    const where: Prisma.EpisodeWhereInput = { seriesId };
    if (!includeUnpublished) {
      where.status = { in: ['published', 'ready'] };
    }

    return prisma.episode.findMany({
      where,
      orderBy: { episodeNumber: 'asc' },
    });
  }

  async update(id: string, creatorId: string, input: UpdateEpisodeInput): Promise<Episode> {
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: { series: { select: { creatorId: true } } },
    });
    if (!episode) throw new NotFoundError('Episode');
    if (episode.series.creatorId !== creatorId) {
      throw new ForbiddenError('You can only edit your own episodes');
    }

    const data: Prisma.EpisodeUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.episodeNumber !== undefined) data.episodeNumber = input.episodeNumber;
    if (input.isFree !== undefined) data.isFree = input.isFree;
    if (input.priceCents !== undefined) data.priceCents = input.priceCents;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.releaseDate !== undefined) data.releaseDate = input.releaseDate;
    if (input.drmEnabled !== undefined) data.drmEnabled = input.drmEnabled;
    if (input.thumbnailUrl !== undefined) data.thumbnailUrl = input.thumbnailUrl;
    if (input.captions !== undefined) data.captions = input.captions;
    if (input.chapters !== undefined) data.chapters = input.chapters;
    if (input.status !== undefined) data.status = input.status;
    if (input.videoAssetId !== undefined) data.videoAssetId = input.videoAssetId;
    if (input.sourceFileUrl !== undefined) data.sourceFileUrl = input.sourceFileUrl;
    if (input.durationSeconds !== undefined) data.durationSeconds = input.durationSeconds;
    if (input.resolution !== undefined) data.resolution = input.resolution;

    return prisma.episode.update({ where: { id }, data });
  }

  async archive(id: string, creatorId: string): Promise<Episode> {
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: { series: { select: { creatorId: true } } },
    });
    if (!episode) throw new NotFoundError('Episode');
    if (episode.series.creatorId !== creatorId) {
      throw new ForbiddenError('You can only archive your own episodes');
    }

    return prisma.episode.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  async generateUploadUrl(id: string, creatorId: string): Promise<{ uploadUrl: string; key: string }> {
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: { series: { select: { creatorId: true } } },
    });
    if (!episode) throw new NotFoundError('Episode');
    if (episode.series.creatorId !== creatorId) {
      throw new ForbiddenError('You can only upload to your own episodes');
    }

    // Generate pre-signed URL for R2 upload
    const key = `uploads/${episode.seriesId}/${episode.id}/source.mp4`;

    // In production, this would use @aws-sdk/s3-request-presigner
    // For now, return a placeholder that the upload service would handle
    const uploadUrl = `${process.env.R2_PUBLIC_URL || 'https://upload.fy.video'}/${key}?X-Amz-Expires=3600`;

    await prisma.episode.update({
      where: { id },
      data: { status: 'uploading', sourceFileUrl: key },
    });

    return { uploadUrl, key };
  }

  async getPaywallData(episodeId: string, viewerUserId?: string) {
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        series: {
          select: {
            id: true,
            title: true,
            slug: true,
            fullSeriesPriceCents: true,
            currency: true,
            affiliateCommissionPct: true,
          },
        },
      },
    });

    if (!episode) throw new NotFoundError('Episode');

    // Get episode count and viewer's existing purchases
    const [episodeCount, viewerPurchases, unlockCount, completionStats] = await Promise.all([
      prisma.episode.count({ where: { seriesId: episode.seriesId, status: 'published' } }),
      viewerUserId
        ? prisma.purchase.findMany({
            where: {
              userId: viewerUserId,
              status: 'completed',
              OR: [{ seriesId: episode.seriesId }, { episodeId: episode.id }],
            },
            select: { episodeId: true, seriesId: true },
          })
        : [],
      prisma.purchase.count({
        where: { episodeId, status: 'completed' },
      }),
      prisma.viewerProgress.aggregate({
        where: { episodeId, completed: true },
        _count: true,
      }),
    ]);

    const purchasedEpisodeIds = viewerPurchases
      .filter((p) => p.episodeId)
      .map((p) => p.episodeId!);
    const hasBundlePurchase = viewerPurchases.some((p) => p.seriesId);

    // Calculate dynamic bundle price
    let bundlePriceCents = episode.series.fullSeriesPriceCents;
    if (bundlePriceCents && purchasedEpisodeIds.length > 0 && !hasBundlePurchase) {
      const paidForEpisodes = await prisma.purchase.aggregate({
        where: {
          userId: viewerUserId!,
          status: 'completed',
          episodeId: { in: purchasedEpisodeIds },
        },
        _sum: { amountCents: true },
      });
      bundlePriceCents = Math.max(
        bundlePriceCents - (paidForEpisodes._sum.amountCents || 0),
        episode.priceCents || 0,
      );
    }

    // Check for active promos
    const now = new Date();
    const promo = await prisma.promoCode.findFirst({
      where: {
        OR: [{ seriesId: episode.seriesId }, { episodeId: episode.id }],
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
    });

    const totalPurchasers = unlockCount;
    const completedCount = completionStats._count;

    return {
      episode: {
        id: episode.id,
        title: episode.title,
        durationSeconds: episode.durationSeconds,
        thumbnailUrl: episode.thumbnailUrl,
        previewUrl: null, // Would be generated as signed URL
      },
      pricing: {
        episodePriceCents: episode.priceCents,
        currency: episode.currency,
        bundleAvailable: !!bundlePriceCents && !hasBundlePurchase,
        bundlePriceCents,
        bundleEpisodeCount: episodeCount,
        bundleSavingsPct: bundlePriceCents && episode.priceCents
          ? Math.round((1 - bundlePriceCents / (episode.priceCents * episodeCount)) * 100)
          : 0,
        promoActive: !!promo,
        promoPriceCents: promo
          ? promo.discountCents
            ? (episode.priceCents || 0) - promo.discountCents
            : Math.round(((episode.priceCents || 0) * (100 - Number(promo.discountPct || 0))) / 100)
          : null,
        promoExpiresAt: promo?.expiresAt?.toISOString() || null,
      },
      social: {
        unlockCount: totalPurchasers,
        completionRate: totalPurchasers > 0 ? Math.round((completedCount / totalPurchasers) * 100) : 0,
      },
      viewer: {
        isAuthenticated: !!viewerUserId,
        purchasedEpisodeIds,
        hasBundlePurchase,
      },
    };
  }
}

export const episodeService = new EpisodeService();
