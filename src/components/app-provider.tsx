'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { Sound } from '@/lib/catalog';
import { isGameCharacterId, type GameCharacterId } from '@/lib/game-characters';
import { haptic } from '@/lib/native';
import { useI18n } from './i18n-provider';
type Saved = {
  favorites: string[];
  scores: Record<string, number>;
  plays: number;
  volume: number;
  gameCharacter: GameCharacterId;
};
const defaults: Saved = { favorites: [], scores: {}, plays: 0, volume: 0.7, gameCharacter: 'dreamy' };
type AppContext = Saved & {
  ready: boolean;
  sounds: Sound[];
  soundCatalogStatus: 'loading' | 'ready' | 'error';
  soundCatalogHasMore: boolean;
  soundCatalogLoadingMore: boolean;
  soundCatalogMoreError: boolean;
  loadMoreSounds: () => Promise<void>;
  ensureSoundLoaded: (id: string) => void;
  refreshSoundCatalog: () => void;
  playing: string[];
  loadingSounds: string[];
  current: Sound | undefined;
  error: string;
  play: (sound: Sound) => void;
  stop: () => void;
  toggleFavorite: (id: string) => void;
  saveScore: (id: string, score: number) => void;
  setVolume: (n: number) => void;
  setGameCharacter: (id: GameCharacterId) => void;
};
const Context = createContext<AppContext | null>(null);
type SoundCatalogState = {
  status: 'loading' | 'ready' | 'error';
  sounds: Sound[];
  nextCursor: string | null;
  loadingMore: boolean;
  moreError: boolean;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [soundCatalog, setSoundCatalog] = useState<SoundCatalogState>({ status: 'loading', sounds: [], nextCursor: null, loadingMore: false, moreError: false });
  const [soundCatalogAttempt, setSoundCatalogAttempt] = useState(0);
  const soundCatalogCursor = useRef<string | null>(null);
  const soundCatalogGeneration = useRef(0);
  const soundCatalogLoadingGeneration = useRef<number | null>(null);
  const soundLookups = useRef(new Set<string>());
  const [playing, setPlaying] = useState<string[]>([]);
  const [loadingSounds, setLoadingSounds] = useState<string[]>([]);
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
        gameCharacter: isGameCharacterId(data.gameCharacter)
          ? data.gameCharacter
          : defaults.gameCharacter,
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
    const generation = ++soundCatalogGeneration.current;
    soundCatalogCursor.current = null;
    soundCatalogLoadingGeneration.current = null;
    void fetchSoundPage(endpoint, null, controller.signal)
      .then((page) => {
        if (generation !== soundCatalogGeneration.current) return;
        soundCatalogCursor.current = page.nextCursor;
        if (controller.signal.aborted) return;
        setSoundCatalog({ status: 'ready', sounds: page.sounds, nextCursor: page.nextCursor, loadingMore: false, moreError: false });
      })
      .catch(() => {
        if (!controller.signal.aborted && generation === soundCatalogGeneration.current) {
          setSoundCatalog({ status: 'error', sounds: [], nextCursor: null, loadingMore: false, moreError: false });
        }
      });
    return () => controller.abort();
  }, [soundCatalogAttempt]);

  const loadMoreSounds = useCallback(async () => {
    const cursor = soundCatalogCursor.current;
    const generation = soundCatalogGeneration.current;
    if (!cursor || soundCatalogLoadingGeneration.current === generation) return;
    soundCatalogLoadingGeneration.current = generation;
    const endpoint = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? `${window.location.origin}/api/public`;
    setSoundCatalog((catalog) => ({ ...catalog, loadingMore: true, moreError: false }));
    try {
      const page = await fetchSoundPage(endpoint, cursor);
      if (generation !== soundCatalogGeneration.current) return;
      soundCatalogCursor.current = page.nextCursor;
      setSoundCatalog((catalog) => {
        const knownIds = new Set(catalog.sounds.map((sound) => sound.id));
        return {
          ...catalog,
          sounds: [...catalog.sounds, ...page.sounds.filter((sound) => !knownIds.has(sound.id))],
          nextCursor: page.nextCursor,
          moreError: false,
        };
      });
    } catch {
      if (generation === soundCatalogGeneration.current) setSoundCatalog((catalog) => ({ ...catalog, moreError: true }));
    } finally {
      if (soundCatalogLoadingGeneration.current === generation) soundCatalogLoadingGeneration.current = null;
      if (generation === soundCatalogGeneration.current) setSoundCatalog((catalog) => ({ ...catalog, loadingMore: false }));
    }
  }, []);

  const ensureSoundLoaded = useCallback((id: string) => {
    if (!id || soundLookups.current.has(id)) return;
    soundLookups.current.add(id);
    const generation = soundCatalogGeneration.current;
    const endpoint = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? `${window.location.origin}/api/public`;
    const url = new URL(`${endpoint}/sounds/${encodeURIComponent(id)}`, window.location.origin);
    void fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { sound?: unknown };
        const sound = parseSound(data.sound, 0);
        if (!sound || generation !== soundCatalogGeneration.current) return;
        setSoundCatalog((catalog) => catalog.sounds.some((item) => item.id === sound.id)
          ? catalog
          : { ...catalog, sounds: [...catalog.sounds, sound] });
      })
      .catch(() => undefined);
  }, []);

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
      p.onplaying = null;
      p.onended = null;
      p.onerror = null;
      p.pause();
      p.removeAttribute('src');
    });
    players.current.clear();
    setPlaying([]);
    setLoadingSounds([]);
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
  function recordSoundPlay(id: string) {
    setSoundCatalog((catalog) => ({
      ...catalog,
      sounds: catalog.sounds.map((item) => item.id === id ? { ...item, playCount: item.playCount + 1 } : item),
    }));

    const endpoint = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? `${window.location.origin}/api/public`;
    void fetch(`${endpoint}/sounds/${encodeURIComponent(id)}/plays`, { method: 'POST', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { playCount?: unknown };
        if (typeof result.playCount !== 'number' || !Number.isSafeInteger(result.playCount) || result.playCount < 0) return;
        setSoundCatalog((catalog) => ({
          ...catalog,
          sounds: catalog.sounds.map((item) => item.id === id ? { ...item, playCount: Math.max(item.playCount, result.playCount as number) } : item),
        }));
      })
      .catch(() => undefined);
  }
  function play(sound: Sound) {
    setError('');
    const existing = players.current.get(sound.id);
    if (existing) {
      existing.onplaying = null;
      existing.onended = null;
      existing.onerror = null;
      existing.pause();
      existing.removeAttribute('src');
      players.current.delete(sound.id);
      setPlaying(ids => ids.filter(id => id !== sound.id));
      setLoadingSounds(ids => ids.filter(id => id !== sound.id));
      return;
    }
    if (players.current.size >= 10) {
      const first = players.current.keys().next().value!;
      const previous = players.current.get(first);
      if (previous) {
        previous.onplaying = null;
        previous.onended = null;
        previous.onerror = null;
        previous.pause();
        previous.removeAttribute('src');
      }
      players.current.delete(first);
      setPlaying(ids => ids.filter(id => id !== first));
      setLoadingSounds(ids => ids.filter(id => id !== first));
    }
    const audio = new Audio(sound.file);
    audio.volume = saved.volume;
    players.current.set(sound.id, audio);
    setLoadingSounds(ids => ids.includes(sound.id) ? ids : [...ids, sound.id]);
    let counted = false;
    const start = () => {
      if (players.current.get(sound.id) !== audio) return;
      setLoadingSounds(ids => ids.filter(id => id !== sound.id));
      setPlaying(ids => ids.includes(sound.id) ? ids : [...ids, sound.id]);
      if (counted) return;
      counted = true;
      recordSoundPlay(sound.id);
      setSaved((s) => ({ ...s, plays: s.plays + 1 }));
    };
    const clear = () => {
      if (players.current.get(sound.id) === audio) {
        players.current.delete(sound.id);
        setPlaying(ids => ids.filter(id => id !== sound.id));
        setLoadingSounds(ids => ids.filter(id => id !== sound.id));
      }
    };
    audio.onplaying = start;
    audio.onended = clear;
    audio.onerror = () => {
      if (players.current.get(sound.id) !== audio) return;
      clear();
      setError(t('errors.audioNamed', { name: sound.name }));
    };
    void audio
      .play()
      .then(() => {
        if (players.current.get(sound.id) !== audio) return;
        start();
      })
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
        loadingSounds,
        sounds: soundCatalog.sounds,
        soundCatalogStatus: soundCatalog.status,
        soundCatalogHasMore: Boolean(soundCatalog.nextCursor),
        soundCatalogLoadingMore: soundCatalog.loadingMore,
        soundCatalogMoreError: soundCatalog.moreError,
        loadMoreSounds,
        ensureSoundLoaded,
        refreshSoundCatalog: () => {
          soundCatalogCursor.current = null;
          soundCatalogGeneration.current += 1;
          soundCatalogLoadingGeneration.current = null;
          soundLookups.current.clear();
          setSoundCatalog({ status: 'loading', sounds: [], nextCursor: null, loadingMore: false, moreError: false });
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
        setGameCharacter: (gameCharacter) => setSaved((s) => ({ ...s, gameCharacter })),
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

async function fetchSoundPage(endpoint: string, cursor: string | null, signal?: AbortSignal) {
  const url = new URL(`${endpoint}/sounds`, window.location.origin);
  url.searchParams.set('limit', '12');
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await fetch(url, { cache: 'no-store', signal });
  const data = await response.json() as { sounds?: unknown; nextCursor?: unknown; error?: string };
  if (!response.ok || !Array.isArray(data.sounds)) throw new Error(data.error || 'Sound catalog unavailable.');
  const sounds = data.sounds.flatMap((value, index): Sound[] => {
    const sound = parseSound(value, index);
    return sound ? [sound] : [];
  });
  return { sounds, nextCursor: typeof data.nextCursor === 'string' && data.nextCursor ? data.nextCursor : null };
}

function parseSound(value: unknown, index: number): Sound | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name || typeof item.file !== 'string' || typeof item.category !== 'string' || !item.category) return null;
  try {
    const audioUrl = new URL(item.file);
    if (audioUrl.protocol !== 'https:' && audioUrl.protocol !== 'http:') return null;
  } catch { return null; }
  return {
    id: item.id,
    name: item.name,
    file: item.file,
    category: item.category,
    color: typeof item.color === 'number' && Number.isInteger(item.color) ? Math.min(3, Math.max(0, item.color)) : index % 4,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : null,
    playCount: typeof item.playCount === 'number' && Number.isSafeInteger(item.playCount) && item.playCount >= 0 ? item.playCount : 0,
  };
}
