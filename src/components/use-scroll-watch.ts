'use client';
import { useEffect, useRef, type RefObject } from 'react';
import { createScrollWatchTracker } from '@/lib/scroll-watch';

export type ReportScrollWatch = (id: string, signal: { watchedMs: number; durationMs: number }) => Promise<void>;

export function useScrollWatch(id: string, video: RefObject<HTMLVideoElement | null>, enabled: boolean, report: ReportScrollWatch) {
  const tracker = useRef(createScrollWatchTracker());
  const lastSent = useRef(0);
  const pending = useRef(false);
  const retryAfter = useRef(0);
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const sample = () => tracker.current.sample({ now: performance.now(), position: player.currentTime, duration: player.duration,
      rate: player.playbackRate, playing: enabled && !document.hidden && !player.paused && !player.seeking && player.readyState >= 3 });
    const flush = () => {
      const watchedMs = tracker.current.value();
      if (pending.current || Date.now() < retryAfter.current || watchedMs < 500 || watchedMs <= lastSent.current || !Number.isFinite(player.duration) || player.duration <= 0) return;
      pending.current = true;
      void report(id, { watchedMs, durationMs: Math.min(3600_000, Math.max(1, Math.round(player.duration * 1000))) })
        .then(() => { lastSent.current = watchedMs; })
        .catch(() => { retryAfter.current = Date.now() + 15_000; })
        .finally(() => { pending.current = false; });
    };
    const tick = () => {
      const watched = sample();
      if ([2000, 10_000, 30_000, 60_000, 120_000].some(mark => watched >= mark && lastSent.current < mark)) flush();
    };
    const onVisibility = () => { sample(); if (document.hidden) flush(); };
    const onPause = () => { sample(); flush(); };
    sample();
    if (!enabled) flush();
    const interval = enabled ? window.setInterval(tick, 250) : null;
    document.addEventListener('visibilitychange', onVisibility);
    player.addEventListener('pause', onPause);
    window.addEventListener('pagehide', onPause);
    return () => {
      sample();
      flush();
      if (interval !== null) window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      player.removeEventListener('pause', onPause);
      window.removeEventListener('pagehide', onPause);
    };
  }, [enabled, id, report, video]);
}
