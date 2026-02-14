'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatCents, timeAgo } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['purchases', 'recent'],
    queryFn: () => api.listPurchases({ limit: '10', sort: 'recent' }),
    enabled: !!user && user.role === 'viewer',
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    if (user.role === 'creator') {
      router.replace('/dashboard/creator');
    } else if (user.role === 'affiliate') {
      router.replace('/dashboard/affiliate');
    } else if (user.role === 'admin') {
      router.replace('/dashboard/admin');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!user || user.role !== 'viewer') {
    return null;
  }

  const purchaseList = (purchases?.data ?? []) as Array<{
    id: string;
    seriesTitle?: string;
    episodeTitle?: string;
    amountCents: number;
    createdAt: string;
  }>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome back, {user.displayName || user.email}
        </h1>
        <p className="mt-2 text-slate-600">
          Your personal dashboard. Browse content and manage your library.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/library"
          className="card flex items-center gap-4 p-6 transition-shadow hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
            <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">My Library</h3>
            <p className="text-sm text-slate-500">Watch your purchased content</p>
          </div>
        </Link>

        <Link
          href="/series"
          className="card flex items-center gap-4 p-6 transition-shadow hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50">
            <svg className="h-6 w-6 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Browse Series</h3>
            <p className="text-sm text-slate-500">Discover new content</p>
          </div>
        </Link>

        <Link
          href="/auth/register?role=creator"
          className="card flex items-center gap-4 p-6 transition-shadow hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Become a Creator</h3>
            <p className="text-sm text-slate-500">Start monetizing your videos</p>
          </div>
        </Link>
      </div>

      {/* Recent Purchases */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent Purchases</h2>
        {purchasesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : purchaseList.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-slate-500">No purchases yet.</p>
            <Link href="/series" className="btn-primary mt-4 inline-block px-6 py-2">
              Browse Series
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {purchaseList.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {purchase.seriesTitle || purchase.episodeTitle || 'Untitled'}
                  </p>
                  <p className="text-sm text-slate-500">{timeAgo(purchase.createdAt)}</p>
                </div>
                <span className="badge-success">{formatCents(purchase.amountCents)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
