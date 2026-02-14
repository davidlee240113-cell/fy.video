'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCents, generateIdempotencyKey, getAffiliateCode } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type PaywallState = 'preview' | 'expanded' | 'processing' | 'unlocked' | 'error';

interface PaywallData {
  episodeTitle: string;
  episodeNumber: number;
  seriesTitle: string;
  seriesId: string;
  thumbnailUrl?: string;
  priceCents: number;
  currency: string;
  bundlePriceCents?: number;
  bundleEpisodeCount?: number;
  nextEpisodeTitle?: string;
  nextEpisodeNumber?: number;
  previewDurationSeconds?: number;
  socialProof?: {
    purchaseCount: number;
    avgRating?: number;
  };
}

interface PaywallCardProps {
  episodeId: string;
  onUnlock?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PaywallCard({ episodeId, onUnlock }: PaywallCardProps) {
  const [state, setState] = useState<PaywallState>('preview');
  const [data, setData] = useState<PaywallData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showBundle, setShowBundle] = useState(false);

  // ── Fetch paywall data ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function fetchPaywall() {
      try {
        const res = await api.getEpisodePaywall(episodeId);
        if (!cancelled) {
          setData(res.data as PaywallData);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : 'Failed to load paywall data';
          setErrorMessage(message);
          setState('error');
        }
      }
    }

    fetchPaywall();
    return () => { cancelled = true; };
  }, [episodeId]);

  // ── Purchase flow ──────────────────────────────────────────────────────

  const handlePurchase = useCallback(async (type: 'episode' | 'series') => {
    if (!data) return;
    setState('processing');
    setErrorMessage(null);

    try {
      const idempotencyKey = generateIdempotencyKey();
      const affiliateCode = getAffiliateCode();

      if (type === 'episode') {
        await api.purchaseEpisode(episodeId, idempotencyKey, affiliateCode);
      } else {
        await api.purchaseSeries(data.seriesId, idempotencyKey, affiliateCode);
      }

      setState('unlocked');
      onUnlock?.();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : 'Purchase failed. Please try again.';
      setErrorMessage(message);
      setState('error');
    }
  }, [data, episodeId, onUnlock]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setState('expanded');
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────

  if (!data && state !== 'error') {
    return (
      <div className="animate-fade-in card mx-auto max-w-md p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="mt-3 text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (state === 'error') {
    return (
      <div className="animate-slide-up card mx-auto max-w-md p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-900">Something went wrong</p>
        <p className="mt-1 text-sm text-slate-500">{errorMessage}</p>
        <button onClick={handleRetry} className="btn-primary mt-4 w-full">
          Try Again
        </button>
      </div>
    );
  }

  // ── Unlocked state ─────────────────────────────────────────────────────

  if (state === 'unlocked') {
    return (
      <div className="animate-slide-up card mx-auto max-w-md p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-slate-900">Unlocked!</p>
        <p className="mt-1 text-sm text-slate-500">Loading your episode now...</p>
      </div>
    );
  }

  // ── Preview / Expanded / Processing states ─────────────────────────────

  const isExpanded = state === 'expanded' || state === 'processing';

  return (
    <div className="animate-slide-up card mx-auto max-w-md overflow-hidden">
      {/* Thumbnail / next episode preview */}
      {data!.thumbnailUrl && (
        <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
          <img
            src={data!.thumbnailUrl}
            alt={data!.episodeTitle}
            className="h-full w-full object-cover"
          />
          <div className="paywall-blur absolute inset-0 flex items-center justify-center bg-black/40">
            <svg className="h-12 w-12 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        </div>
      )}

      <div className="p-6">
        {/* Episode info */}
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-brand-600">
          {data!.seriesTitle}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          Ep. {data!.episodeNumber}: {data!.episodeTitle}
        </h3>

        {/* Next episode teaser */}
        {data!.nextEpisodeTitle && (
          <p className="mt-2 text-sm text-slate-500">
            Up next: Ep. {data!.nextEpisodeNumber} &mdash; {data!.nextEpisodeTitle}
          </p>
        )}

        {/* Social proof */}
        {data!.socialProof && data!.socialProof.purchaseCount > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {[...Array(Math.min(3, data!.socialProof.purchaseCount))].map((_, i) => (
                <div
                  key={i}
                  className="h-6 w-6 rounded-full border-2 border-white bg-gradient-to-br from-brand-400 to-brand-600"
                />
              ))}
            </div>
            <span className="text-xs text-slate-500">
              {data!.socialProof.purchaseCount.toLocaleString()} viewer{data!.socialProof.purchaseCount !== 1 ? 's' : ''} unlocked this
            </span>
            {data!.socialProof.avgRating && (
              <span className="text-xs text-amber-500">
                {'★'.repeat(Math.round(data!.socialProof.avgRating))} {data!.socialProof.avgRating.toFixed(1)}
              </span>
            )}
          </div>
        )}

        {/* Price and CTA */}
        <div className="mt-5">
          {state === 'preview' ? (
            <button
              onClick={() => setState('expanded')}
              className="btn-primary w-full py-3 text-base"
            >
              Unlock &amp; Watch Now &mdash; {formatCents(data!.priceCents, data!.currency)}
            </button>
          ) : (
            <>
              {/* Single episode purchase */}
              <button
                onClick={() => handlePurchase('episode')}
                disabled={state === 'processing'}
                className="btn-primary w-full py-3 text-base disabled:cursor-not-allowed"
              >
                {state === 'processing' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <>Unlock &amp; Watch Now &mdash; {formatCents(data!.priceCents, data!.currency)}</>
                )}
              </button>

              {/* Bundle upsell */}
              {data!.bundlePriceCents && data!.bundleEpisodeCount && isExpanded && (
                <div className="mt-3">
                  {!showBundle ? (
                    <button
                      onClick={() => setShowBundle(true)}
                      className="w-full text-center text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Save with full series bundle
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase('series')}
                      disabled={state === 'processing'}
                      className="btn-secondary w-full py-3"
                    >
                      <span className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-slate-900">
                          Get all {data!.bundleEpisodeCount} episodes &mdash; {formatCents(data!.bundlePriceCents!, data!.currency)}
                        </span>
                        <span className="text-xs text-emerald-600">
                          Save {formatCents(
                            data!.priceCents * data!.bundleEpisodeCount! - data!.bundlePriceCents!,
                            data!.currency,
                          )}
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Trust signals */}
        {isExpanded && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure checkout
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Instant access
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
