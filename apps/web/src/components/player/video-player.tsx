'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface Chapter {
  title: string;
  startTime: number;
}

interface Caption {
  label: string;
  srclang: string;
  src: string;
}

interface VideoPlayerProps {
  playbackUrl: string;
  episodeId: string;
  onProgress?: (currentTime: number, duration: number) => void;
  chapters?: Chapter[];
  captions?: Caption[];
  poster?: string;
  qualities?: { label: string; src: string }[];
  autoPlay?: boolean;
}

type QualityOption = { label: string; src: string };

// ── Component ────────────────────────────────────────────────────────────────

export function VideoPlayer({
  playbackUrl,
  episodeId,
  onProgress,
  chapters = [],
  captions = [],
  poster,
  qualities = [],
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastReportedRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);

  // Menus
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [activeQuality, setActiveQuality] = useState<QualityOption | null>(null);

  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Heartbeat progress reporting ─────────────────────────────────────────

  const sendHeartbeat = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.paused) return;

    const seconds = Math.floor(video.currentTime);
    if (seconds === lastReportedRef.current) return;

    lastReportedRef.current = seconds;
    try {
      await api.updateProgress(episodeId, seconds, getDeviceType());
    } catch {
      // Silently fail -- heartbeat is best-effort
    }
  }, [episodeId]);

  useEffect(() => {
    heartbeatRef.current = setInterval(sendHeartbeat, 15_000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      // Send one final heartbeat on unmount
      sendHeartbeat();
    };
  }, [sendHeartbeat]);

  // ── Controls auto-hide ───────────────────────────────────────────────────

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  const handleMouseMove = useCallback(() => {
    scheduleHideControls();
  }, [scheduleHideControls]);

  // ── Video event handlers ─────────────────────────────────────────────────

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    onProgress?.(video.currentTime, video.duration);

    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }
  }, [onProgress]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    setShowControls(true);
  }, []);

  // ── Control actions ──────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleSeekBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      seek(pct * duration);
    },
    [duration, seek],
  );

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const toggleCaptions = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const newEnabled = !captionsEnabled;
    setCaptionsEnabled(newEnabled);
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = newEnabled ? 'showing' : 'hidden';
    }
  }, [captionsEnabled]);

  const switchQuality = useCallback(
    (quality: QualityOption) => {
      const video = videoRef.current;
      if (!video) return;
      const wasPlaying = !video.paused;
      const time = video.currentTime;
      video.src = quality.src;
      video.currentTime = time;
      if (wasPlaying) video.play();
      setActiveQuality(quality);
      setShowQualityMenu(false);
    },
    [],
  );

  const jumpToChapter = useCallback(
    (chapter: Chapter) => {
      seek(chapter.startTime);
      setShowChapterMenu(false);
    },
    [seek],
  );

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when this player container or video is focused
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, currentTime - 10));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(duration, currentTime + 10));
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'c':
          e.preventDefault();
          if (captions.length > 0) toggleCaptions();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seek, currentTime, duration, toggleFullscreen, toggleMute, toggleCaptions, captions.length]);

  // ── Fullscreen change listener ───────────────────────────────────────────

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={playbackUrl}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        className="h-full w-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onClick={togglePlay}
      >
        {captions.map((cap) => (
          <track
            key={cap.srclang}
            kind="subtitles"
            label={cap.label}
            srcLang={cap.srclang}
            src={cap.src}
          />
        ))}
      </video>

      {/* Click-to-play overlay center icon */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
          aria-label="Play"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
            <svg className="ml-1 h-7 w-7 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}

      {/* Controls overlay */}
      <div
        className={`player-overlay absolute inset-x-0 bottom-0 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex flex-col gap-2 px-4 pb-4 pt-12">
          {/* Chapter markers on seek bar */}
          <div className="relative h-1.5 cursor-pointer rounded-full bg-white/20" onClick={handleSeekBarClick}>
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/30"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Progress */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-brand-500"
              style={{ width: `${progressPct}%` }}
            />
            {/* Chapter markers */}
            {chapters.map((ch) => {
              const pct = duration > 0 ? (ch.startTime / duration) * 100 : 0;
              return (
                <div
                  key={ch.startTime}
                  className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-white/60"
                  style={{ left: `${pct}%` }}
                  title={ch.title}
                />
              );
            })}
            {/* Scrubber thumb */}
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          {/* Bottom controls row */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button onClick={togglePlay} className="p-1 hover:text-brand-300" aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1.5">
                <button onClick={toggleMute} className="p-1 hover:text-brand-300" aria-label={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted || volume === 0 ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-16 cursor-pointer accent-brand-500"
                  aria-label="Volume"
                />
              </div>

              {/* Time display */}
              <span className="text-xs tabular-nums text-white/80">
                {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Chapters */}
              {chapters.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowChapterMenu(!showChapterMenu);
                      setShowQualityMenu(false);
                    }}
                    className="rounded p-1 text-xs hover:bg-white/20"
                    aria-label="Chapters"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </button>
                  {showChapterMenu && (
                    <div className="absolute bottom-full right-0 mb-2 w-56 rounded-lg bg-slate-900/95 p-2 shadow-xl backdrop-blur-sm">
                      {chapters.map((ch) => (
                        <button
                          key={ch.startTime}
                          onClick={() => jumpToChapter(ch)}
                          className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-white/10"
                        >
                          <span className="truncate">{ch.title}</span>
                          <span className="ml-2 text-xs text-white/60">{formatDuration(Math.floor(ch.startTime))}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Captions toggle */}
              {captions.length > 0 && (
                <button
                  onClick={toggleCaptions}
                  className={`rounded p-1 text-xs hover:bg-white/20 ${captionsEnabled ? 'text-brand-400' : ''}`}
                  aria-label={captionsEnabled ? 'Disable captions' : 'Enable captions'}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </button>
              )}

              {/* Quality selector */}
              {qualities.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowQualityMenu(!showQualityMenu);
                      setShowChapterMenu(false);
                    }}
                    className="rounded p-1 text-xs hover:bg-white/20"
                    aria-label="Quality"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 w-36 rounded-lg bg-slate-900/95 p-2 shadow-xl backdrop-blur-sm">
                      {qualities.map((q) => (
                        <button
                          key={q.label}
                          onClick={() => switchQuality(q)}
                          className={`flex w-full items-center rounded px-3 py-2 text-left text-sm hover:bg-white/10 ${
                            activeQuality?.label === q.label ? 'text-brand-400' : ''
                          }`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="rounded p-1 hover:bg-white/20"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}
