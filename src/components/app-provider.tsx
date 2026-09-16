'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { sounds, type Sound } from '@/lib/catalog';
import { haptic } from '@/lib/native';
type Saved = { favorites: string[]; scores: Record<string, number>; plays: number; volume: number };
const defaults: Saved = { favorites: [], scores: {}, plays: 0, volume: 0.7 };
type AppContext = Saved & {
  ready: boolean;
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
  const [saved, setSaved] = useState(defaults);
  const [ready, setReady] = useState(false);
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
              (id: unknown) => typeof id === 'string' && sounds.some((s) => s.id === id),
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
      setError(`Could not play ${sound.name}. Please try again.`);
    };
    void audio
      .play()
      .then(() => setSaved((s) => ({ ...s, plays: s.plays + 1 })))
      .catch(() => {
        if (players.current.get(sound.id) !== audio) return;
        clear();
        setError('Audio could not start. Tap a sound to try again.');
      });
    void haptic();
  }
  return (
    <Context.Provider
      value={{
        ...saved,
        ready,
        playing,
        current: sounds.find((s) => s.id === playing.at(-1)),
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
