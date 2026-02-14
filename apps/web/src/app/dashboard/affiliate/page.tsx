'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/utils';

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['affiliate-dashboard'],
    queryFn: () => api.getAffiliateDashboard(),
    enabled: !!user && user.role === 'affiliate',
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login');
    } else if (user.role !== 'affiliate') {
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

  if (!user || user.role !== 'affiliate') {
    return null;
  }

  const dashData = (dashboard?.data ?? {}) as {
    totalEarningsCents?: number;
    pendingEarningsCents?: number;
    paidEarningsCents?: number;
    payoutStatus?: string;
    nextPayoutDate?: string;
    links?: Array<{
      id: string;
      code: string;
      seriesTitle: string;
      seriesSlug: string;
      clicks: number;
      conversions: number;
      earningsCents: number;
      commissionPercent: number;
      url?: string;
    }>;
  };

  const links = dashData.links ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Affiliate Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Track your earnings, manage links, and grow your commissions.
        </p>
      </div>

      {/* Earnings Summary */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <p className="text-sm font-medium text-slate-500">All-Time Earnings</p>
          {dashboardLoading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatCents(dashData.totalEarningsCents ?? 0)}
            </p>
          )}
        </div>

        <div className="card p-6">
          <p className="text-sm font-medium text-slate-500">Pending</p>
          {dashboardLoading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-amber-600">
              {formatCents(dashData.pendingEarningsCents ?? 0)}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">Awaiting payout</p>
        </div>

        <div className="card p-6">
          <p className="text-sm font-medium text-slate-500">Paid Out</p>
          {dashboardLoading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {formatCents(dashData.paidEarningsCents ?? 0)}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">Total received</p>
        </div>

        <div className="card p-6">
          <p className="text-sm font-medium text-slate-500">Payout Status</p>
          {dashboardLoading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
          ) : (
            <>
              <p className="mt-2">
                <span
                  className={
                    dashData.payoutStatus === 'scheduled'
                      ? 'badge-success'
                      : dashData.payoutStatus === 'pending'
                        ? 'badge-warning'
                        : 'badge-default'
                  }
                >
                  {dashData.payoutStatus ?? 'No payouts'}
                </span>
              </p>
              {dashData.nextPayoutDate && (
                <p className="mt-2 text-sm text-slate-500">
                  Next: {new Date(dashData.nextPayoutDate).toLocaleDateString()}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Affiliate Links */}
      <div className="card p-6">
        <h2 className="mb-6 text-lg font-semibold text-slate-900">Your Affiliate Links</h2>

        {dashboardLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : links.length === 0 ? (
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
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <p className="mt-4 text-slate-500">
              No affiliate links yet. Browse series to start promoting!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <AffiliateLinkCard key={link.id} link={link} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AffiliateLinkCard({
  link,
}: {
  link: {
    id: string;
    code: string;
    seriesTitle: string;
    seriesSlug: string;
    clicks: number;
    conversions: number;
    earningsCents: number;
    commissionPercent: number;
    url?: string;
  };
}) {
  const [copied, setCopied] = useState(false);

  const affiliateUrl =
    link.url ||
    `${typeof window !== 'undefined' ? window.location.origin : ''}/series/${link.seriesSlug}?ref=${link.code}`;

  const conversionRate =
    link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(affiliateUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = affiliateUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareMutation = useMutation({
    mutationFn: (platform: string) => api.recordShare(link.id, platform),
  });

  const handleShare = (platform: string) => {
    shareMutation.mutate(platform);
    const text = encodeURIComponent(`Check out "${link.seriesTitle}" on fy.video!`);
    const url = encodeURIComponent(affiliateUrl);

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      email: `mailto:?subject=${text}&body=${url}`,
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-slate-900">{link.seriesTitle}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Commission: {link.commissionPercent}%
          </p>
        </div>
        <span className="badge-success">{formatCents(link.earningsCents)} earned</span>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{link.clicks}</p>
          <p className="text-xs text-slate-500">Clicks</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{link.conversions}</p>
          <p className="text-xs text-slate-500">Conversions</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{conversionRate}%</p>
          <p className="text-xs text-slate-500">Conv. Rate</p>
        </div>
      </div>

      {/* Link + Actions */}
      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={affiliateUrl}
          className="input flex-1 truncate text-sm"
        />
        <button
          onClick={handleCopy}
          className="btn-primary whitespace-nowrap px-4 py-2 text-sm"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Share Buttons */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-slate-500">Share:</span>
        {['twitter', 'facebook', 'linkedin', 'email'].map((platform) => (
          <button
            key={platform}
            onClick={() => handleShare(platform)}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium capitalize text-slate-600 transition-colors hover:bg-slate-50"
          >
            {platform === 'email' ? 'Email' : platform.charAt(0).toUpperCase() + platform.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
