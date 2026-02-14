'use client';

import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type ShareEarnState = 'prompt' | 'pre-filled' | 'processing' | 'success' | 'already-affiliate';

interface AffiliateResult {
  affiliateLink: string;
  affiliateLinkId: string;
  commissionPercent: number;
  estimatedEarningsCents?: number;
}

interface ShareEarnCardProps {
  seriesId: string;
  episodeId?: string;
  prefillEmail?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ShareEarnCard({ seriesId, episodeId, prefillEmail }: ShareEarnCardProps) {
  const [state, setState] = useState<ShareEarnState>(prefillEmail ? 'pre-filled' : 'prompt');
  const [email, setEmail] = useState(prefillEmail ?? '');
  const [result, setResult] = useState<AffiliateResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // ── Submit handler ─────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setState('processing');
    setErrorMessage(null);

    try {
      const res = await api.instantAffiliate(email.trim(), seriesId, episodeId ? `episode:${episodeId}` : 'series-page');
      const data = res.data as AffiliateResult;
      setResult(data);
      setState('success');
    } catch (err: unknown) {
      const parsed = err as { status?: number; message?: string };
      if (parsed.status === 409) {
        // Already an affiliate -- the API might still return the link
        setState('already-affiliate');
        if (parsed.message) setErrorMessage(parsed.message);
      } else {
        setErrorMessage(parsed.message ?? 'Something went wrong. Please try again.');
        setState('prompt');
      }
    }
  }, [email, seriesId, episodeId]);

  // ── Copy to clipboard ─────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!result?.affiliateLink) return;
    try {
      await navigator.clipboard.writeText(result.affiliateLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input
      linkInputRef.current?.select();
    }
  }, [result]);

  // ── Share handlers ─────────────────────────────────────────────────────

  const shareUrl = result?.affiliateLink ?? '';
  const shareText = 'Check out this video series!';

  const recordShareAndOpen = useCallback(async (platform: string, url: string) => {
    if (result?.affiliateLinkId) {
      try {
        await api.recordShare(result.affiliateLinkId, platform);
      } catch { /* best-effort */ }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [result]);

  const shareLinks = [
    {
      platform: 'twitter',
      label: 'Twitter',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      platform: 'whatsapp',
      label: 'WhatsApp',
      url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
    {
      platform: 'email',
      label: 'Email',
      url: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      platform: 'linkedin',
      label: 'LinkedIn',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="animate-slide-up card mx-auto max-w-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-4">
        <h3 className="text-lg font-semibold text-white">Share &amp; Earn</h3>
        <p className="mt-0.5 text-sm text-white/80">
          Earn commission for every viewer you refer
        </p>
      </div>

      <div className="p-6">
        {/* Success / Already-affiliate state */}
        {(state === 'success' || state === 'already-affiliate') && result ? (
          <div className="space-y-5">
            {state === 'already-affiliate' && (
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Welcome back! Here is your affiliate link.
              </div>
            )}

            {/* Affiliate link with copy */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                Your affiliate link
              </label>
              <div className="flex gap-2">
                <input
                  ref={linkInputRef}
                  type="text"
                  readOnly
                  value={result.affiliateLink}
                  className="input flex-1 truncate bg-slate-50 text-sm"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopy}
                  className={`btn-primary shrink-0 px-3 ${copied ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                >
                  {copied ? (
                    <span className="flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Share buttons */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
                Share via
              </label>
              <div className="grid grid-cols-4 gap-2">
                {shareLinks.map((link) => (
                  <button
                    key={link.platform}
                    onClick={() => recordShareAndOpen(link.platform, link.url)}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 py-3 text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    {link.icon}
                    <span className="text-xs">{link.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* QR Code placeholder */}
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-6">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100">
                  <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                  </svg>
                </div>
                <p className="text-xs text-slate-400">QR code</p>
              </div>
            </div>

            {/* Earnings preview */}
            {result.commissionPercent > 0 && (
              <div className="rounded-lg bg-emerald-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-800">Your commission</span>
                  <span className="text-sm font-bold text-emerald-700">{result.commissionPercent}%</span>
                </div>
                {result.estimatedEarningsCents != null && result.estimatedEarningsCents > 0 && (
                  <p className="mt-1 text-xs text-emerald-600">
                    Earn ~${(result.estimatedEarningsCents / 100).toFixed(2)} per sale you refer
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Prompt / Pre-filled / Processing states */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">
                Enter your email to get a unique affiliate link. Share it anywhere and earn commission
                on every sale you drive.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <div>
              <label htmlFor="share-earn-email" className="sr-only">
                Email address
              </label>
              <input
                id="share-earn-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state === 'processing'}
                className="input w-full"
              />
            </div>

            <button
              type="submit"
              disabled={state === 'processing' || !email.trim()}
              className="btn-accent w-full py-3 text-base"
            >
              {state === 'processing' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating your link...
                </span>
              ) : (
                'Get My Link'
              )}
            </button>

            <p className="text-center text-xs text-slate-400">
              No account needed. We'll email you earnings reports.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
