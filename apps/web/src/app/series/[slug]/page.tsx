'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCents, formatDuration } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

interface Episode {
  id: string;
  title: string;
  description: string | null;
  order: number;
  durationSeconds: number;
  isFree: boolean;
  priceCents: number;
  thumbnailUrl: string | null;
  status: string;
}

interface SeriesDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
  trailerUrl: string | null;
  episodes: Episode[];
  episodeCount: number;
  totalDurationSeconds: number;
  pricePerEpisodeCents: number;
  bundlePriceCents: number | null;
  affiliateCommissionPercent: number;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
  status: string;
  publishedAt: string | null;
}

interface SeriesResponse {
  data: SeriesDetail;
}

export default function SeriesDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [affiliateEmail, setAffiliateEmail] = useState('');
  const [affiliateSubmitted, setAffiliateSubmitted] = useState(false);
  const [affiliateLink, setAffiliateLink] = useState('');
  const [affiliateError, setAffiliateError] = useState('');

  const { data, isLoading, isError, error } = useQuery<SeriesResponse>({
    queryKey: ['series', slug],
    queryFn: () => api.getSeries(slug) as Promise<SeriesResponse>,
    enabled: !!slug,
  });

  const series = data?.data;

  const handleAffiliateSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAffiliateError('');
    if (!series) return;

    try {
      const result = (await api.instantAffiliate(affiliateEmail, series.id)) as {
        data: { affiliateLink: string; code: string };
      };
      setAffiliateLink(result.data.affiliateLink);
      setAffiliateSubmitted(true);
    } catch (err) {
      setAffiliateError(
        (err as { message?: string })?.message ||
          'Failed to generate affiliate link. Please try again.',
      );
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-6 w-48 rounded bg-slate-200" />
          <div className="mt-6 grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="aspect-video rounded-xl bg-slate-200" />
              <div className="h-8 w-3/4 rounded bg-slate-200" />
              <div className="h-4 w-full rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-200" />
            </div>
            <div className="space-y-4">
              <div className="card p-6 space-y-3">
                <div className="h-6 w-1/2 rounded bg-slate-200" />
                <div className="h-10 rounded bg-slate-200" />
                <div className="h-10 rounded bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !series) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">
            Series not found
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {(error as { message?: string })?.message ||
              'The series you are looking for does not exist or has been removed.'}
          </p>
          <Link href="/series" className="btn-primary mt-6 inline-block">
            Browse all series
          </Link>
        </div>
      </div>
    );
  }

  const totalDuration = series.totalDurationSeconds || 0;
  const freeEpisodeCount = series.episodes?.filter((ep) => ep.isFree).length ?? 0;
  const paidEpisodeCount = (series.episodes?.length ?? 0) - freeEpisodeCount;
  const bundleSavings =
    series.bundlePriceCents != null && series.episodes
      ? series.pricePerEpisodeCents * paidEpisodeCount - series.bundlePriceCents
      : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/series" className="hover:text-slate-700">
          Series
        </Link>
        <span>/</span>
        <span className="text-slate-900">{series.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          {/* Thumbnail / Trailer */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
            {series.thumbnailUrl ? (
              <img
                src={series.thumbnailUrl}
                alt={series.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300">
                <svg
                  className="h-16 w-16 text-brand-400"
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
            {series.trailerUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <button className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform hover:scale-110">
                  <svg
                    className="ml-1 h-7 w-7 text-brand-600"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Series info */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              {series.category && (
                <span className="badge-info">{series.category}</span>
              )}
              {series.status === 'published' && (
                <span className="badge-success">Published</span>
              )}
            </div>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              {series.title}
            </h1>

            {/* Creator */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600">
                {series.creatorAvatarUrl ? (
                  <img
                    src={series.creatorAvatarUrl}
                    alt={series.creatorName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  series.creatorName?.charAt(0).toUpperCase() || 'C'
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {series.creatorName}
                </p>
                <p className="text-xs text-slate-500">Creator</p>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 flex flex-wrap gap-6 rounded-lg border border-slate-200 bg-white p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Episodes
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {series.episodeCount ?? series.episodes?.length ?? 0}
                </p>
              </div>
              {totalDuration > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Total Duration
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatDuration(totalDuration)}
                  </p>
                </div>
              )}
              {freeEpisodeCount > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Free Episodes
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-600">
                    {freeEpisodeCount}
                  </p>
                </div>
              )}
              {series.affiliateCommissionPercent > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Affiliate Commission
                  </p>
                  <p className="mt-1 text-lg font-semibold text-accent-600">
                    {series.affiliateCommissionPercent}%
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            {series.description && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-slate-900">About</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {series.description}
                </p>
              </div>
            )}
          </div>

          {/* Episode list */}
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-slate-900">
              Episodes
              {series.episodes && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({series.episodes.length})
                </span>
              )}
            </h2>

            {(!series.episodes || series.episodes.length === 0) && (
              <p className="mt-4 text-sm text-slate-500">
                No episodes available yet. Check back soon.
              </p>
            )}

            <div className="mt-4 space-y-3">
              {series.episodes
                ?.sort((a, b) => a.order - b.order)
                .map((episode, idx) => (
                  <div
                    key={episode.id}
                    className="card group flex items-center gap-4 p-4 transition-shadow hover:shadow-sm"
                  >
                    {/* Episode number */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
                      {idx + 1}
                    </div>

                    {/* Thumbnail */}
                    {episode.thumbnailUrl && (
                      <div className="hidden h-14 w-24 flex-shrink-0 overflow-hidden rounded-md bg-slate-100 sm:block">
                        <img
                          src={episode.thumbnailUrl}
                          alt={episode.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-medium text-slate-900">
                          {episode.title}
                        </h3>
                        {episode.isFree ? (
                          <span className="badge-success flex-shrink-0">Free</span>
                        ) : (
                          <span className="badge-warning flex-shrink-0">
                            {formatCents(episode.priceCents)}
                          </span>
                        )}
                      </div>
                      {episode.description && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {episode.description}
                        </p>
                      )}
                    </div>

                    {/* Duration */}
                    {episode.durationSeconds > 0 && (
                      <span className="flex-shrink-0 text-xs text-slate-500">
                        {formatDuration(episode.durationSeconds)}
                      </span>
                    )}

                    {/* Action */}
                    <div className="flex-shrink-0">
                      {episode.isFree ? (
                        <Link
                          href={`/series/${slug}/${episode.id}`}
                          className="text-sm font-medium text-brand-600 hover:text-brand-700"
                        >
                          Watch
                        </Link>
                      ) : (
                        <svg
                          className="h-4 w-4 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing card */}
          <div className="card sticky top-24 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Pricing</h3>

            {/* Per-episode pricing */}
            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Per Episode
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatCents(series.pricePerEpisodeCents)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Pay as you go for individual episodes
              </p>
            </div>

            {/* Bundle pricing */}
            {series.bundlePriceCents != null && (
              <div className="mt-3 rounded-lg border-2 border-brand-200 bg-brand-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-brand-600">
                    Full Series Bundle
                  </p>
                  {bundleSavings > 0 && (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                      Save {formatCents(bundleSavings)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-bold text-brand-700">
                  {formatCents(series.bundlePriceCents)}
                </p>
                <p className="mt-1 text-xs text-brand-600">
                  Get all {series.episodeCount ?? series.episodes?.length ?? 0} episodes
                </p>
              </div>
            )}

            {/* CTA buttons */}
            <div className="mt-6 space-y-3">
              {series.bundlePriceCents != null && (
                <button
                  onClick={() =>
                    user
                      ? router.push(`/series/${slug}/purchase?type=bundle`)
                      : router.push(`/auth/login?redirect=/series/${slug}`)
                  }
                  className="btn-primary w-full"
                >
                  Buy Full Series
                </button>
              )}
              {freeEpisodeCount > 0 && series.episodes && (
                <Link
                  href={`/series/${slug}/${series.episodes.find((ep) => ep.isFree)?.id}`}
                  className="btn-secondary w-full text-center"
                >
                  Start Free Episode
                </Link>
              )}
            </div>

            {/* Commission notice */}
            {series.affiliateCommissionPercent > 0 && (
              <p className="mt-4 text-center text-xs text-slate-500">
                Earn {series.affiliateCommissionPercent}% commission by sharing
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Share & Earn section */}
      {series.affiliateCommissionPercent > 0 && (
        <section className="mt-16 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 lg:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-100">
              <svg
                className="h-7 w-7 text-accent-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Share & Earn {series.affiliateCommissionPercent}% Commission
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Love this series? Share it with your audience and earn{' '}
              {formatCents(
                Math.round(
                  (series.bundlePriceCents ?? series.pricePerEpisodeCents) *
                    (series.affiliateCommissionPercent / 100),
                ),
              )}{' '}
              per sale. No signup required — just enter your email to get a
              trackable affiliate link.
            </p>

            {affiliateSubmitted && affiliateLink ? (
              <div className="mt-6">
                <p className="mb-3 text-sm font-medium text-emerald-700">
                  Your affiliate link is ready:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={affiliateLink}
                    className="input flex-1 text-center text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(affiliateLink)}
                    className="btn-primary flex-shrink-0 px-4"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Share this link anywhere. You will earn{' '}
                  {series.affiliateCommissionPercent}% on every sale made through
                  it.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleAffiliateSignup}
                className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
              >
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={affiliateEmail}
                  onChange={(e) => setAffiliateEmail(e.target.value)}
                  className="input w-full max-w-xs"
                />
                <button type="submit" className="btn-accent w-full sm:w-auto">
                  Get Affiliate Link
                </button>
              </form>
            )}
            {affiliateError && (
              <p className="mt-3 text-sm text-red-600">{affiliateError}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
