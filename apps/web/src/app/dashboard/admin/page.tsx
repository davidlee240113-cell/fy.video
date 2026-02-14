'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatCents, formatNumber, timeAgo } from '@/lib/utils';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [auditPage, setAuditPage] = useState(1);

  const { data: revenue, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn: () => api.getRevenueAnalytics(),
    enabled: !!user && user.role === 'admin',
  });

  const { data: revenue30d } = useQuery({
    queryKey: ['admin-revenue-30d'],
    queryFn: () => api.getRevenueAnalytics(30),
    enabled: !!user && user.role === 'admin',
  });

  const { data: allSeries } = useQuery({
    queryKey: ['admin-series'],
    queryFn: () => api.listSeries({ limit: '5' }),
    enabled: !!user && user.role === 'admin',
  });

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['admin-purchases', auditPage],
    queryFn: () =>
      api.listPurchases({ limit: '20', offset: String((auditPage - 1) * 20) }),
    enabled: !!user && user.role === 'admin',
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login');
    } else if (user.role !== 'admin') {
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

  if (!user || user.role !== 'admin') {
    return null;
  }

  const revenueData = (revenue?.data ?? {}) as {
    totalRevenueCents?: number;
    purchaseCount?: number;
    userCount?: number;
    creatorCount?: number;
  };

  const revenue30dData = (revenue30d?.data ?? {}) as {
    totalRevenueCents?: number;
    purchaseCount?: number;
  };

  const seriesList = (allSeries?.data ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    creatorName?: string;
  }>;

  const purchaseList = (purchases?.data ?? []) as Array<{
    id: string;
    userId?: string;
    userEmail?: string;
    seriesTitle?: string;
    episodeTitle?: string;
    amountCents: number;
    status: string;
    createdAt: string;
  }>;

  const purchasePagination = (purchases?.pagination ?? {}) as {
    total?: number;
    limit?: number;
    offset?: number;
  };

  const totalPages = Math.ceil((purchasePagination.total ?? 0) / 20);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Platform overview, user management, and audit tools.
        </p>
      </div>

      {/* Platform Stats */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <p className="text-sm font-medium text-slate-500">Total Platform Revenue</p>
          {statsLoading ? (
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
          {statsLoading ? (
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
          {statsLoading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatNumber(revenueData.purchaseCount ?? 0)}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">All time</p>
        </div>

        <div className="card p-6">
          <p className="text-sm font-medium text-slate-500">Users / Creators</p>
          {statsLoading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatNumber(revenueData.userCount ?? 0)}{' '}
              <span className="text-lg font-normal text-slate-400">
                / {formatNumber(revenueData.creatorCount ?? 0)}
              </span>
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">Total / Creators</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/users"
          className="card flex items-center gap-4 p-6 transition-shadow hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
            <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">User Management</h3>
            <p className="text-sm text-slate-500">View, edit, and manage users</p>
          </div>
        </Link>

        <Link
          href="/admin/series"
          className="card flex items-center gap-4 p-6 transition-shadow hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50">
            <svg className="h-6 w-6 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Series Management</h3>
            <p className="text-sm text-slate-500">Review and moderate content</p>
          </div>
        </Link>

        <Link
          href="/admin/payouts"
          className="card flex items-center gap-4 p-6 transition-shadow hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Payouts</h3>
            <p className="text-sm text-slate-500">Manage creator and affiliate payouts</p>
          </div>
        </Link>
      </div>

      {/* Recent Series */}
      <div className="mb-10 card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Series</h2>
          <Link href="/admin/series" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </div>
        {seriesList.length === 0 ? (
          <p className="py-4 text-center text-slate-500">No series on the platform yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {seriesList.map((series) => (
              <div key={series.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-slate-900">{series.title}</p>
                  {series.creatorName && (
                    <p className="text-sm text-slate-500">by {series.creatorName}</p>
                  )}
                </div>
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Purchase Audit Log */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Purchase Audit Log</h2>

        {purchasesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : purchaseList.length === 0 ? (
          <p className="py-8 text-center text-slate-500">No purchases recorded yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 pr-4 font-medium text-slate-500">ID</th>
                    <th className="pb-3 pr-4 font-medium text-slate-500">User</th>
                    <th className="pb-3 pr-4 font-medium text-slate-500">Item</th>
                    <th className="pb-3 pr-4 font-medium text-slate-500">Amount</th>
                    <th className="pb-3 pr-4 font-medium text-slate-500">Status</th>
                    <th className="pb-3 font-medium text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseList.map((purchase) => (
                    <tr key={purchase.id}>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                        {purchase.id.slice(0, 8)}...
                      </td>
                      <td className="py-3 pr-4 text-slate-700">
                        {purchase.userEmail ?? purchase.userId?.slice(0, 8) ?? 'Unknown'}
                      </td>
                      <td className="py-3 pr-4 text-slate-900">
                        {purchase.seriesTitle || purchase.episodeTitle || 'N/A'}
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {formatCents(purchase.amountCents)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            purchase.status === 'completed'
                              ? 'badge-success'
                              : purchase.status === 'pending'
                                ? 'badge-warning'
                                : purchase.status === 'refunded'
                                  ? 'badge-error'
                                  : 'badge-default'
                          }
                        >
                          {purchase.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">{timeAgo(purchase.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                <p className="text-sm text-slate-500">
                  Page {auditPage} of {totalPages} ({purchasePagination.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={auditPage === 1}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setAuditPage((p) => Math.min(totalPages, p + 1))}
                    disabled={auditPage === totalPages}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
