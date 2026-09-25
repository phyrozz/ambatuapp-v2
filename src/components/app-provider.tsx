'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { Sound } from '@/lib/catalog';
import { haptic } from '@/lib/native';
import { useI18n } from './i18n-provider';
type Saved = { favorites: string[]; scores: Record<string, number>; plays: number; volume: number };
const defaults: Saved = { favorites: [], scores: {}, plays: 0, volume: 0.7 };
type AppContext = Saved & {
  ready: boolean;
  sounds: Sound[];
  soundCatalogStatus: 'loading' | 'ready' | 'error';
  refreshSoundCatalog: () => void;
  playing: string[];
  current: Sound | undefined;
  error: string;
  play: (sound: Sound) => void;
  stop: () => void;
  toggleFavorite: (id: string) => void;
  saveScore: (id: string, score: number) => void;
  setVolume: (n: number) => void;
};
const Context = createContext<AppContext | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [soundCatalog, setSoundCatalog] = useState<{ status: 'loading' | 'ready' | 'error'; sounds: Sound[] }>({ status: 'loading', sounds: [] });
  const [soundCatalogAttempt, setSoundCatalogAttempt] = useState(0);
  const [playing, setPlaying] = useState<string[]>([]);
  const [error, setError] = useState('');
  const players = useRef(new Map<string, HTMLAudioElement>());
  // Hydrate browser storage after mount so the server export and first client render match.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem('ambatuapp-v1') || '{}');
      setSaved({
        favorites: Array.isArray(data.favorites)
          ? data.favorites.filter(
              (id: unknown) => typeof id === 'string',
            )
          : [],
        scores:
          data.scores && typeof data.scores === 'object'
            ? (Object.fromEntries(
                Object.entries(data.scores).filter(
                  ([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
                ),
              ) as Record<string, number>)
            : {},
        plays: Number.isFinite(data.plays) ? Math.max(0, data.plays) : 0,
        volume: Number.isFinite(data.volume) ? Math.min(1, Math.max(0, data.volume)) : 0.7,
      });
    } catch {
      /* A fresh session is usable when storage is unavailable. */
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? `${window.location.origin}/api/public`;
    const controller = new AbortController();
    void fetch(`${endpoint}/sounds`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { sounds?: unknown; error?: string };
        if (!response.ok || !Array.isArray(data.sounds)) throw new Error(data.error || 'Sound catalog unavailable.');
        const items = data.sounds.flatMap((value, index): Sound[] => {
          if (!value || typeof value !== 'object') return [];
          const item = value as Record<string, unknown>;
          if (typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name || typeof item.file !== 'string' || typeof item.category !== 'string' || !item.category) return [];
          try {
            const url = new URL(item.file);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return [];
          } catch { return []; }
          return [{
            id: item.id,
            name: item.name,
            file: item.file,
            category: item.category,
            color: typeof item.color === 'number' && Number.isInteger(item.color) ? Math.min(3, Math.max(0, item.color)) : index % 4,
          }];
        });
        if (controller.signal.aborted) return;
        setSoundCatalog({ status: 'ready', sounds: items });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSoundCatalog({ status: 'error', sounds: [] });
      });
    return () => controller.abort();
  }, [soundCatalogAttempt]);

  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem('ambatuapp-v1', JSON.stringify(saved));
      } catch {
        /* Private storage can be unavailable. */
      }
    }
  }, [ready, saved]);
  const stop = useCallback(() => {
    players.current.forEach((p) => {
      p.onended = null;
      p.onerror = null;
      p.pause();
      p.removeAttribute('src');
    });
    players.current.clear();
    setPlaying([]);
  }, []);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', pause);
    const appListener = Capacitor.isNativePlatform()
      ? import('@capacitor/app').then(({ App }) =>
          App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) stop();
          }),
        )
      : null;
    return () => {
      stop();
      document.removeEventListener('visibilitychange', pause);
      void appListener?.then((l) => l.remove());
    };
  }, [stop]);
  function play(sound: Sound) {
    setError('');
    const existing = players.current.get(sound.id);
    if (existing) {
      existing.pause();
      players.current.delete(sound.id);
      setPlaying([...players.current.keys()]);
      return;
    }
    if (players.current.size >= 10) {
      const first = players.current.keys().next().value!;
      players.current.get(first)?.pause();
      players.current.delete(first);
    }
    const audio = new Audio(sound.file);
    audio.volume = saved.volume;
    players.current.set(sound.id, audio);
    setPlaying([...players.current.keys()]);
    const clear = () => {
      if (players.current.get(sound.id) === audio) {
        players.current.delete(sound.id);
        setPlaying([...players.current.keys()]);
      }
    };
    audio.onended = clear;
    audio.onerror = () => {
      if (players.current.get(sound.id) !== audio) return;
      clear();
      setError(t('errors.audioNamed', { name: sound.name }));
    };
    void audio
      .play()
      .then(() => setSaved((s) => ({ ...s, plays: s.plays + 1 })))
      .catch(() => {
        if (players.current.get(sound.id) !== audio) return;
        clear();
        setError(t('errors.audioStart'));
      });
    void haptic();
  }
  return (
    <Context.Provider
      value={{
        ...saved,
        ready,
        playing,
        sounds: soundCatalog.sounds,
        soundCatalogStatus: soundCatalog.status,
        refreshSoundCatalog: () => {
          setSoundCatalog({ status: 'loading', sounds: [] });
          setSoundCatalogAttempt((attempt) => attempt + 1);
        },
        current: soundCatalog.sounds.find((s) => s.id === playing.at(-1)),
        error,
        play,
        stop,
        toggleFavorite: (id) =>
          setSaved((s) => ({
            ...s,
            favorites: s.favorites.includes(id)
              ? s.favorites.filter((f) => f !== id)
              : [...s.favorites, id],
          })),
        saveScore: (id, score) =>
          setSaved((s) => ({
            ...s,
            scores: { ...s.scores, [id]: Math.max(s.scores[id] || 0, score) },
          })),
        setVolume: (volume) => {
          players.current.forEach((p) => (p.volume = volume));
          setSaved((s) => ({ ...s, volume }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider is required');
  return value;
}
