'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatCents, formatNumber } from '@/lib/utils';
import Link from 'next/link';

export default function CreatorDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue-analytics'],
    queryFn: () => api.getRevenueAnalytics(),
    enabled: !!user && user.role === 'creator',
  });

  const { data: revenue30d } = useQuery({
    queryKey: ['revenue-analytics', '30d'],
    queryFn: () => api.getRevenueAnalytics(30),
    enabled: !!user && user.role === 'creator',
  });

  const { data: seriesData, isLoading: seriesLoading } = useQuery({
    queryKey: ['creator-series', user?.id],
    queryFn: () => api.listSeries({ creator_id: user!.id }),
    enabled: !!user && user.role === 'creator',
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login');
    } else if (user.role !== 'creator') {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!user || user.role !== 'creator') {
    return null;
  }

  const revenueData = (revenue?.data ?? {}) as {
    totalRevenueCents?: number;
    purchaseCount?: number;
  };

  const revenue30dData = (revenue30d?.data ?? {}) as {
    totalRevenueCents?: number;
    purchaseCount?: number;
  };

  const seriesList = (seriesData?.data ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    episodeCount?: number;
    thumbnailUrl?: string;
    priceCents?: number;
  }>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Creator Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Manage your series, track revenue, and grow your audience.
          </p>
        </div>
        <Link href="/dashboard/creator/series/new" className="btn-primary px-6 py-2.5">
          + Create New Series
        </Link>
      </div>

      {/* Revenue Widgets */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-6">
          <p className="text-sm font-medium text-slate-500">Total Revenue</p>
          {revenueLoading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatCents(revenueData.totalRevenueCents ?? 0)}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">All time</p>
        </div>

        <div className="card p-6">
          <p className="text-sm font-medium text-slate-500">30-Day Revenue</p>
          {revenueLoading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {formatCents(revenue30dData.totalRevenueCents ?? 0)}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">Last 30 days</p>
        </div>

        <div className="card p-6">
          <p className="text-sm font-medium text-slate-500">Total Purchases</p>
          {revenueLoading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatNumber(revenueData.purchaseCount ?? 0)}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">All time</p>
        </div>
      </div>

      {/* Series List */}
      <div className="card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Your Series</h2>
          <span className="text-sm text-slate-500">
            {seriesList.length} {seriesList.length === 1 ? 'series' : 'series'}
          </span>
        </div>

        {seriesLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : seriesList.length === 0 ? (
          <div className="py-12 text-center">
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
            <p className="mt-4 text-slate-500">No series yet. Create your first one!</p>
            <Link
              href="/dashboard/creator/series/new"
              className="btn-primary mt-4 inline-block px-6 py-2"
            >
              + Create New Series
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {seriesList.map((series) => (
              <div key={series.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  {series.thumbnailUrl ? (
                    <img
                      src={series.thumbnailUrl}
                      alt={series.title}
                      className="h-14 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-20 items-center justify-center rounded-lg bg-slate-100">
                      <svg
                        className="h-6 w-6 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-slate-900">{series.title}</h3>
                    <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                      <span
                        className={
                          series.status === 'published'
                            ? 'badge-success'
                            : series.status === 'draft'
                              ? 'badge-warning'
                              : 'badge-default'
                        }
                      >
                        {series.status}
                      </span>
                      {series.episodeCount !== undefined && (
                        <span>{series.episodeCount} episodes</span>
                      )}
                      {series.priceCents !== undefined && (
                        <span>{formatCents(series.priceCents)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/creator/series/${series.id}/edit`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Edit
                  </Link>
                  {series.status === 'draft' && (
                    <PublishButton seriesId={series.id} />
                  )}
                  <Link
                    href={`/series/${series.slug}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PublishButton({ seriesId }: { seriesId: string }) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () => api.publishSeries(seriesId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-series'] });
    },
  });

  return (
    <button
      onClick={() => mutate()}
      disabled={isPending}
      className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
    >
      {isPending ? 'Publishing...' : 'Publish'}
    </button>
  );
}
