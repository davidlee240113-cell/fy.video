'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCents, formatDuration, timeAgo } from '@/lib/utils';

interface PurchasedEpisode {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  seriesSlug: string;
  seriesTitle: string;
}

interface PurchasedSeries {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  episodeCount: number;
  completedEpisodes: number;
}

interface Purchase {
  id: string;
  type: 'episode' | 'series';
  status: string;
  amountCents: number;
  createdAt: string;
  episode: PurchasedEpisode | null;
  series: PurchasedSeries | null;
  lastWatchedEpisodeId: string | null;
  watchProgressSeconds: number;
  totalDurationSeconds: number;
}

interface PurchasesResponse {
  data: Purchase[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function LibraryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login?redirect=/library');
    }
  }, [user, authLoading, router]);

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<PurchasesResponse>({
    queryKey: ['purchases'],
    queryFn: () => api.listPurchases() as Promise<PurchasesResponse>,
    enabled: !!user,
  });

  const purchases = data?.data ?? [];

  const continueWatching = purchases.filter(
    (p) =>
      p.status === 'completed' &&
      p.watchProgressSeconds > 0 &&
      p.watchProgressSeconds < p.totalDurationSeconds,
  );

  const completedPurchases = purchases.filter(
    (p) => p.status === 'completed',
  );

  const seriesPurchases = completedPurchases.filter(
    (p) => p.type === 'series',
  );
  const episodePurchases = completedPurchases.filter(
    (p) => p.type === 'episode',
  );

  // Auth gate
  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          My Library
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Your purchased content and watch history
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-6">
          <div className="h-6 w-48 rounded bg-slate-200 animate-pulse" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card animate-pulse overflow-hidden">
                <div className="aspect-video bg-slate-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <svg
            className="mx-auto h-10 w-10 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h3 className="mt-3 text-lg font-semibold text-red-900">
            Failed to load your library
          </h3>
          <p className="mt-1 text-sm text-red-600">
            {(error as { message?: string })?.message ||
              'An unexpected error occurred. Please try again.'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && purchases.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-slate-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-4 text-xl font-semibold text-slate-900">
            Your library is empty
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Browse our catalog and purchase your first series or episode to get
            started.
          </p>
          <Link href="/series" className="btn-primary mt-6 inline-block">
            Browse Series
          </Link>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && purchases.length > 0 && (
        <div className="space-y-12">
          {/* Continue Watching */}
          {continueWatching.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Continue Watching
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {continueWatching.map((purchase) => {
                  const title =
                    purchase.episode?.title ??
                    purchase.series?.title ??
                    'Untitled';
                  const thumbnail =
                    purchase.episode?.thumbnailUrl ??
                    purchase.series?.thumbnailUrl;
                  const slug =
                    purchase.episode?.seriesSlug ??
                    purchase.series?.slug ??
                    '';
                  const progressPercent =
                    purchase.totalDurationSeconds > 0
                      ? Math.round(
                          (purchase.watchProgressSeconds /
                            purchase.totalDurationSeconds) *
                            100,
                        )
                      : 0;

                  return (
                    <Link
                      key={purchase.id}
                      href={
                        purchase.lastWatchedEpisodeId
                          ? `/series/${slug}/${purchase.lastWatchedEpisodeId}`
                          : `/series/${slug}`
                      }
                      className="card group overflow-hidden transition-shadow hover:shadow-md"
                    >
                      <div className="relative aspect-video bg-slate-100">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
                            <svg
                              className="h-10 w-10 text-brand-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                        )}

                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                            <svg
                              className="ml-0.5 h-5 w-5 text-brand-600"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                          <div
                            className="h-full bg-brand-500 transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-600">
                          {title}
                        </h3>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                          <span>{progressPercent}% watched</span>
                          {purchase.watchProgressSeconds > 0 && (
                            <span>
                              {formatDuration(purchase.watchProgressSeconds)} /{' '}
                              {formatDuration(purchase.totalDurationSeconds)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Series Purchases */}
          {seriesPurchases.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                My Series
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {seriesPurchases.map((purchase) => {
                  const series = purchase.series;
                  if (!series) return null;

                  const completionPercent =
                    series.episodeCount > 0
                      ? Math.round(
                          (series.completedEpisodes / series.episodeCount) * 100,
                        )
                      : 0;

                  return (
                    <Link
                      key={purchase.id}
                      href={`/series/${series.slug}`}
                      className="card group overflow-hidden transition-shadow hover:shadow-md"
                    >
                      <div className="relative aspect-video bg-slate-100">
                        {series.thumbnailUrl ? (
                          <img
                            src={series.thumbnailUrl}
                            alt={series.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
                            <svg
                              className="h-10 w-10 text-brand-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                              />
                            </svg>
                          </div>
                        )}
                        <div className="absolute right-2 top-2">
                          <span className="badge-success">Owned</span>
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-600">
                          {series.title}
                        </h3>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>
                            {series.completedEpisodes} / {series.episodeCount}{' '}
                            episodes
                          </span>
                          <span>{completionPercent}% complete</span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-500 transition-all"
                            style={{ width: `${completionPercent}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          Purchased {timeAgo(purchase.createdAt)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Episode Purchases */}
          {episodePurchases.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Individual Episodes
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {episodePurchases.map((purchase) => {
                  const episode = purchase.episode;
                  if (!episode) return null;

                  return (
                    <Link
                      key={purchase.id}
                      href={`/series/${episode.seriesSlug}/${episode.id}`}
                      className="card group flex items-center gap-4 p-4 transition-shadow hover:shadow-md"
                    >
                      {/* Thumbnail */}
                      <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {episode.thumbnailUrl ? (
                          <img
                            src={episode.thumbnailUrl}
                            alt={episode.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
                            <svg
                              className="h-6 w-6 text-brand-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-600">
                          {episode.title}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {episode.seriesTitle}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                          {episode.durationSeconds > 0 && (
                            <span>
                              {formatDuration(episode.durationSeconds)}
                            </span>
                          )}
                          <span>{formatCents(purchase.amountCents)}</span>
                          <span>{timeAgo(purchase.createdAt)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
