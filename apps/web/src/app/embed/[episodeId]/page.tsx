'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getAffiliateCode } from '@/lib/utils';
import { VideoPlayer } from '@/components/player/video-player';
import { PaywallCard } from '@/components/paywall/paywall-card';

// ── Types ────────────────────────────────────────────────────────────────────

type EmbedState = 'loading' | 'player' | 'paywall' | 'error';

// ── Page component ───────────────────────────────────────────────────────────

export default function EmbedEpisodePage() {
  const params = useParams<{ episodeId: string }>();
  const searchParams = useSearchParams();
  const episodeId = params.episodeId;

  const [state, setState] = useState<EmbedState>('loading');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Track affiliate ref from URL ─────────────────────────────────────

  useEffect(() => {
    // getAffiliateCode reads ?ref= and persists to cookie
    const ref = searchParams.get('ref');
    if (ref) {
      getAffiliateCode();
    }
  }, [searchParams]);

  // ── Check access and load playback ───────────────────────────────────

  const checkAccessAndLoad = useCallback(async () => {
    setState('loading');
    setErrorMessage(null);

    try {
      const accessRes = await api.checkAccess(episodeId);

      if (accessRes.data.hasAccess) {
        const playbackRes = await api.getPlaybackUrl(episodeId);
        setPlaybackUrl(playbackRes.data.playbackUrl);
        setState('player');
      } else {
        setState('paywall');
      }
    } catch (err: unknown) {
      const parsed = err as { status?: number; message?: string };
      if (parsed.status === 401 || parsed.status === 403) {
        // Not authenticated or no access -- show paywall
        setState('paywall');
      } else {
        setErrorMessage(parsed.message ?? 'Failed to load episode. Please try again.');
        setState('error');
      }
    }
  }, [episodeId]);

  useEffect(() => {
    checkAccessAndLoad();
  }, [checkAccessAndLoad]);

  // ── Unlock handler ───────────────────────────────────────────────────

  const handleUnlock = useCallback(() => {
    // Re-check access after purchase completes
    checkAccessAndLoad();
  }, [checkAccessAndLoad]);

  // ── Progress callback ────────────────────────────────────────────────

  const handleProgress = useCallback((_currentTime: number, _duration: number) => {
    // The VideoPlayer handles heartbeat internally.
    // This callback is available for embed-specific behavior if needed.
  }, []);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-0">
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <p className="text-sm text-white/60">Loading...</p>
        </div>
      )}

      {state === 'player' && playbackUrl && (
        <div className="w-full">
          <VideoPlayer
            playbackUrl={playbackUrl}
            episodeId={episodeId}
            onProgress={handleProgress}
            autoPlay
          />
        </div>
      )}

      {state === 'paywall' && (
        <div className="w-full max-w-md px-4">
          <PaywallCard episodeId={episodeId} onUnlock={handleUnlock} />
        </div>
      )}

      {state === 'error' && (
        <div className="w-full max-w-md px-4">
          <div className="card p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-900">Unable to load episode</p>
            <p className="mt-1 text-sm text-slate-500">{errorMessage}</p>
            <button onClick={checkAccessAndLoad} className="btn-primary mt-4 w-full">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Branding watermark */}
      <div className="fixed bottom-2 right-3">
        <a
          href="https://fy.video"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded bg-black/50 px-2 py-1 text-xs text-white/50 backdrop-blur-sm transition-colors hover:text-white/80"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded bg-brand-600 text-[8px] font-bold text-white">
            fy
          </span>
          fy.video
        </a>
      </div>
    </div>
  );
}
