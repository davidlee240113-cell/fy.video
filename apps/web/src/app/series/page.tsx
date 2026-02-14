'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/utils';

interface Series {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
  episodeCount: number;
  pricePerEpisodeCents: number;
  bundlePriceCents: number | null;
  creatorName: string;
  status: string;
}

interface SeriesResponse {
  data: Series[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const CATEGORIES = [
  'All',
  'Education',
  'Technology',
  'Business',
  'Creative',
  'Health',
  'Lifestyle',
  'Entertainment',
] as const;

export default function BrowseSeriesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: page.toString(), limit: '12' };
  if (search.trim()) params.search = search.trim();
  if (category !== 'All') params.category = category;

  const { data, isLoading, isError, error } = useQuery<SeriesResponse>({
    queryKey: ['series', page, search, category],
    queryFn: () => api.listSeries(params) as Promise<SeriesResponse>,
  });

  const seriesList = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Browse Series
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Discover premium video series from top creators
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search series..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                category === cat
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse overflow-hidden">
              <div className="aspect-video bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-200" />
                <div className="h-3 w-1/4 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
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
            Failed to load series
          </h3>
          <p className="mt-1 text-sm text-red-600">
            {(error as { message?: string })?.message || 'An unexpected error occurred. Please try again.'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && seriesList.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
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
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            No series found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {search || category !== 'All'
              ? 'Try adjusting your search or filters.'
              : 'Check back soon for new content.'}
          </p>
        </div>
      )}

      {/* Series grid */}
      {!isLoading && !isError && seriesList.length > 0 && (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {seriesList.map((series) => (
              <Link
                key={series.id}
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
                  {series.bundlePriceCents != null && (
                    <div className="absolute right-2 top-2 rounded-md bg-accent-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
                      Bundle available
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    {series.category && (
                      <span className="badge-info">{series.category}</span>
                    )}
                  </div>

                  <h3 className="mt-1 text-base font-semibold text-slate-900 line-clamp-2 group-hover:text-brand-600">
                    {series.title}
                  </h3>

                  {series.creatorName && (
                    <p className="mt-1 text-sm text-slate-500 truncate">
                      by {series.creatorName}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-500">
                      {series.episodeCount}{' '}
                      {series.episodeCount === 1 ? 'episode' : 'episodes'}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCents(series.pricePerEpisodeCents)}
                      <span className="text-xs font-normal text-slate-500">
                        {' '}/ ep
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary px-3 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (pagination.totalPages <= 7) return true;
                    if (p === 1 || p === pagination.totalPages) return true;
                    return Math.abs(p - page) <= 1;
                  })
                  .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) {
                      acc.push('ellipsis');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="px-2 text-sm text-slate-400"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
                          page === item
                            ? 'bg-brand-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {item}
                      </button>
                    ),
                  )}
              </div>
              <button
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page >= pagination.totalPages}
                className="btn-secondary px-3 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
