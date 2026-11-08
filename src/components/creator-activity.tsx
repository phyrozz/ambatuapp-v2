'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { creatorRead, CreatorReadError } from '@/lib/creator-profile';
import { games } from '@/lib/catalog';
import type { Dream } from '@/lib/ambatupost';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { DreamFeedCard } from './dream-feed';
import { LoadingIndicator } from './loading-indicator';
import './ambatupost.css';

type Page<T> = { items: T[]; nextCursor: string | null };
function useCreatorPages<T extends { id: string }>(id: string, kind: 'dreams' | 'lores') {
  const { user, ready, getIdToken } = useAuth();
  const [items, setItems] = useState<T[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [ended, setEnded] = useState(false);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const load = useRef<() => void>(() => {});
  const userId = user?.id;
  const getToken = useCallback(async () => {
    const token = await getIdToken();
    if (userId && !token) throw new Error('SESSION_EXPIRED');
    return token;
  }, [getIdToken, userId]);
  const retry = useCallback(() => {
    load.current();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let cursor: string | null = null,
      pending = false,
      done = false;
    // Reset when the viewer, author or content tab changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    setError(false);
    setEnded(false);
    setLoading(true);
    const next = async () => {
      if (pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError(false);
      try {
        const data = await creatorRead<Record<string, unknown>>(
          `/creators/${encodeURIComponent(id)}/${kind}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
          await getToken(),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const page: Page<T> = {
          items: (data[kind] as T[]) ?? [],
          nextCursor: (data.nextCursor as string | null) ?? null,
        };
        setItems((previous) => [
          ...new Map([...previous, ...page.items].map((item) => [item.id, item])).values(),
        ]);
        cursor = page.nextCursor;
        done = !cursor;
        setEnded(done);
      } catch (reason) {
        if (!controller.signal.aborted) {
          if (reason instanceof CreatorReadError && [401, 403, 404].includes(reason.status)) {
            setItems([]);
            if (reason.status === 404) window.dispatchEvent(new Event('ambatu:profile-changed'));
          }
          setError(true);
        }
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load.current = () => {
      void next();
    };
    void next();
    return () => controller.abort();
  }, [ready, id, kind, getToken]);
  useEffect(() => {
    if (!sentinel || loading || error || ended) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load.current();
      },
      { rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, loading, error, ended, items.length]);
  return { items, setItems, loading, error, ended, sentinel: setSentinel, retry, getToken };
}

export function CreatorDreams({ id }: { id: string }) {
  const { t } = useI18n();
  const { items, setItems, loading, error, ended, sentinel, retry, getToken } =
    useCreatorPages<Dream>(id, 'dreams');
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    if (!deleted) return;
    const timer = window.setTimeout(() => setDeleted(false), 5000);
    return () => window.clearTimeout(timer);
  }, [deleted]);
  return (
    <section className="creator-dreams">
      {deleted && (
        <p className="dream-notice" role="status">
          {t('post.deleted')}
        </p>
      )}
      <div className="dream-feed-list" aria-busy={loading}>
        {items.map((dream) => (
          <DreamFeedCard
            key={dream.id}
            dream={dream}
            getToken={getToken}
            onRemove={(dreamId, removed) => {
              setItems((previous) => previous.filter((item) => item.id !== dreamId));
              if (removed) setDeleted(true);
            }}
          />
        ))}
      </div>
      {loading && <LoadingIndicator compact label={t('common.loading')} />}
      {error && (
        <div className="creator-error" role="alert">
          <p>{t('creator.loadError')}</p>
          <button type="button" className="button secondary compact" onClick={retry}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {!loading && !error && ended && !items.length && (
        <p className="dream-empty">{t('creator.noDreams')}</p>
      )}
      <div className="dream-sentinel" ref={sentinel} />
    </section>
  );
}
type Lore = { id: string; title: string; excerpt: string; createdAt: string | null };
export function CreatorLores({ id }: { id: string }) {
  const { t } = useI18n();
  const { items, loading, error, ended, sentinel, retry } = useCreatorPages<Lore>(id, 'lores');
  return (
    <section className="creator-lore-list">
      {items.map((lore) => (
        <article key={lore.id} className="creator-lore-card">
          <BookOpen size={21} aria-hidden="true" />
          <div>
            <h3>
              <Link href={`/lores/${encodeURIComponent(lore.id)}/`}>{lore.title}</Link>
            </h3>
            {lore.excerpt && <p>{lore.excerpt}</p>}
          </div>
        </article>
      ))}
      {loading && <LoadingIndicator compact label={t('common.loading')} />}
      {error && (
        <div className="creator-error" role="alert">
          <p>{t('creator.loadError')}</p>
          <button type="button" className="button secondary compact" onClick={retry}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {!loading && !error && ended && !items.length && (
        <p className="dream-empty">{t('creator.noLores')}</p>
      )}
      <div className="dream-sentinel" ref={sentinel} />
    </section>
  );
}
export function CreatorScores({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { user, ready, getIdToken } = useAuth();
  const userId = user?.id;
  const [scores, setScores] = useState<Array<{ gameId: string; score: number }>>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    // A profile or account switch must discard the previous account's scores.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScores([]);
    setLoading(true);
    setError(false);
    void getIdToken()
      .then((token) => {
        if (userId && !token) throw new Error('SESSION_EXPIRED');
        return creatorRead<{ scores: Array<{ gameId: string; score: number }> }>(
          `/creators/${encodeURIComponent(id)}/scores`,
          token,
          controller.signal,
        );
      })
      .then((data) => {
        if (!controller.signal.aborted) setScores(data.scores);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          if (reason instanceof CreatorReadError && [401, 403, 404].includes(reason.status)) {
            setScores([]);
            if (reason.status === 404) window.dispatchEvent(new Event('ambatu:profile-changed'));
          }
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, userId, ready, getIdToken, version]);
  return (
    <section className="creator-scores">
      <p className="dream-helper">{t('creator.scoresHint')}</p>
      {loading && <LoadingIndicator compact label={t('common.loading')} />}
      {error && (
        <div className="creator-error" role="alert">
          <p>{t('creator.loadError')}</p>
          <button
            type="button"
            className="button secondary compact"
            onClick={() => setVersion((value) => value + 1)}
          >
            {t('common.retry')}
          </button>
        </div>
      )}
      {!loading && !error && !scores.length && (
        <p className="dream-empty">{t('creator.noScores')}</p>
      )}
      <div className="creator-scores-grid">
        {scores.flatMap((score) => {
          const game = games.find((item) => item.id === score.gameId);
          if (!game) return [];
          return [
            <Link
              key={game.id}
              className="creator-score-card"
              href={`/games/${encodeURIComponent(game.id)}/`}
            >
              <img src={game.image} alt="" loading="lazy" />
              <span>{t(`game.${game.id}.name`)}</span>
              <strong>{score.score.toLocaleString(locale)}</strong>
            </Link>,
          ];
        })}
      </div>
    </section>
  );
}
