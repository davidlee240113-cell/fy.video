import { prisma } from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js';
import type { Series, SeriesStatus, SeriesVisibility, Prisma } from '@prisma/client';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let counter = 0;
  while (await prisma.series.findUnique({ where: { slug } })) {
    counter++;
    slug = `${slugify(base)}-${counter}`;
  }
  return slug;
}

export interface CreateSeriesInput {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  trailerUrl?: string;
  visibility?: SeriesVisibility;
  fullSeriesPriceCents?: number;
  currency?: string;
  category?: string;
  tags?: string[];
  geoRestrictions?: Record<string, unknown>;
  affiliateEnabled?: boolean;
  affiliateCommissionPct?: number;
}

export interface UpdateSeriesInput extends Partial<CreateSeriesInput> {
  status?: SeriesStatus;
}

export interface ListSeriesOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  creatorId?: string;
  status?: SeriesStatus;
  visibility?: SeriesVisibility;
}

export class SeriesService {
  async create(creatorId: string, input: CreateSeriesInput): Promise<Series> {
    const slug = await uniqueSlug(input.title);

    return prisma.series.create({
      data: {
        creatorId,
        title: input.title,
        slug,
        description: input.description,
        thumbnailUrl: input.thumbnailUrl,
        trailerUrl: input.trailerUrl,
        visibility: input.visibility || 'public',
        fullSeriesPriceCents: input.fullSeriesPriceCents,
        currency: input.currency || 'USD',
        category: input.category,
        tags: input.tags || [],
        geoRestrictions: input.geoRestrictions || {},
        affiliateEnabled: input.affiliateEnabled ?? true,
        affiliateCommissionPct: input.affiliateCommissionPct,
      },
    });
  }

  async getBySlug(slug: string): Promise<Series & { episodes: unknown[]; creator: unknown }> {
    const series = await prisma.series.findUnique({
      where: { slug },
      include: {
        episodes: {
          where: { status: { in: ['published', 'ready'] } },
          orderBy: { episodeNumber: 'asc' },
          select: {
            id: true,
            episodeNumber: true,
            title: true,
            description: true,
            isFree: true,
            priceCents: true,
            currency: true,
            durationSeconds: true,
            resolution: true,
            thumbnailUrl: true,
            status: true,
            releaseDate: true,
            chapters: true,
          },
        },
        creator: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!series) throw new NotFoundError('Series');
    return series as Series & { episodes: unknown[]; creator: unknown };
  }

  async getById(id: string): Promise<Series> {
    const series = await prisma.series.findUnique({ where: { id } });
    if (!series) throw new NotFoundError('Series');
    return series;
  }

  async list(options: ListSeriesOptions = {}) {
    const { page = 1, limit = 20, category, search, creatorId, status, visibility } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.SeriesWhereInput = {
      ...(category && { category }),
      ...(creatorId && { creatorId }),
      ...(status && { status }),
      ...(visibility && { visibility }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { tags: { has: search.toLowerCase() } },
        ],
      }),
    };

    // Default to public + published for non-creator queries
    if (!creatorId) {
      where.status = 'published';
      where.visibility = 'public';
    }

    const [series, total] = await Promise.all([
      prisma.series.findMany({
        where,
        include: {
          creator: { select: { id: true, displayName: true, avatarUrl: true } },
          _count: { select: { episodes: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.series.count({ where }),
    ]);

    return {
      data: series,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, creatorId: string, input: UpdateSeriesInput): Promise<Series> {
    const series = await this.getById(id);
    if (series.creatorId !== creatorId) {
      throw new ForbiddenError('You can only edit your own series');
    }

    const data: Prisma.SeriesUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.thumbnailUrl !== undefined) data.thumbnailUrl = input.thumbnailUrl;
    if (input.trailerUrl !== undefined) data.trailerUrl = input.trailerUrl;
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (input.fullSeriesPriceCents !== undefined) data.fullSeriesPriceCents = input.fullSeriesPriceCents;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.category !== undefined) data.category = input.category;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.geoRestrictions !== undefined) data.geoRestrictions = input.geoRestrictions;
    if (input.affiliateEnabled !== undefined) data.affiliateEnabled = input.affiliateEnabled;
    if (input.affiliateCommissionPct !== undefined)
      data.affiliateCommissionPct = input.affiliateCommissionPct;

    return prisma.series.update({ where: { id }, data });
  }

  async publish(id: string, creatorId: string): Promise<Series> {
    const series = await this.getById(id);
    if (series.creatorId !== creatorId) {
      throw new ForbiddenError('You can only publish your own series');
    }

    const readyEpisodes = await prisma.episode.count({
      where: { seriesId: id, status: { in: ['ready', 'published'] } },
    });

    if (readyEpisodes === 0) {
      throw new ValidationError('Series must have at least one ready episode to publish');
    }

    // Publish all ready episodes
    await prisma.episode.updateMany({
      where: { seriesId: id, status: 'ready' },
      data: { status: 'published' },
    });

    return prisma.series.update({
      where: { id },
      data: { status: 'published', publishedAt: series.publishedAt || new Date() },
    });
  }

  async archive(id: string, creatorId: string): Promise<Series> {
    const series = await this.getById(id);
    if (series.creatorId !== creatorId) {
      throw new ForbiddenError('You can only archive your own series');
    }

    return prisma.series.update({
      where: { id },
      data: { status: 'archived' },
    });
  }
}

export const seriesService = new SeriesService();
