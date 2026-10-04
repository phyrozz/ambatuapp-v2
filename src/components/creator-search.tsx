'use client';
import Link from 'next/link';
import { Search, X, ArrowUpRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { memberApi } from '@/lib/member-api';
import { creatorHref, creatorSearchIsReady } from '@/lib/creator-profile';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import './creator-profile.css';

type SearchPlayer = { id: string; username: string; avatarUrl: string | null };

function SearchResult({ player }: { player: SearchPlayer }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  return (
    <Link
      className="creator-search-result"
      href={creatorHref(player.id)}
      aria-label={t('creator.view', { name: player.username })}
    >
      <span className="creator-search-avatar" aria-hidden="true">
        {player.avatarUrl && !failed ? (
          <img src={player.avatarUrl} alt="" onError={() => setFailed(true)} />
        ) : (
          player.username.slice(0, 1).toLocaleUpperCase()
        )}
      </span>
      <strong>{player.username}</strong>
      <ArrowUpRight size={18} aria-hidden="true" />
    </Link>
  );
}

export function CreatorSearch({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const { t } = useI18n();
  const { getIdToken } = useAuth();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<SearchPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const load = useRef<() => void>(() => {});
  const active = open && query.trim().length > 0;
  const ready = active && query.trim() === search && creatorSearchIsReady(search);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    onActiveChange(active);
    return () => onActiveChange(false);
  }, [active, onActiveChange]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null,
      pending = false,
      done = false;
    // Reset a query before requesting its first bounded result batch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayers([]);
    setLoading(ready);
    setError(false);
    setEnded(false);
    const next = async () => {
      if (!ready || pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ q: search });
        if (cursor) params.set('cursor', cursor);
        const data = await memberApi<{ players: SearchPlayer[]; nextCursor: string | null }>(
          `/creators/search?${params}`,
          await getIdToken(),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setPlayers((previous) => [
          ...new Map([...previous, ...data.players].map((player) => [player.id, player])).values(),
        ]);
        cursor = data.nextCursor;
        done = !cursor;
        setEnded(done);
      } catch {
        if (!controller.signal.aborted) setError(true);
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
  }, [search, ready, getIdToken]);
  useEffect(() => {
    if (!root || !sentinel || !ready || loading || error || ended) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) load.current();
      },
      { root, rootMargin: '100px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [root, sentinel, ready, players, loading, error, ended]);
  const debouncing = search !== query.trim();
  return (
    <div
      className="creator-search"
      ref={container}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          input.current?.focus();
          setOpen(false);
        }
      }}
    >
      <div className="creator-search-field">
        <Search size={19} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          maxLength={254}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          aria-label={t('creator.search')}
          placeholder={t('creator.searchPlaceholder')}
          aria-describedby={active ? 'creator-search-hint' : undefined}
        />
        {query && (
          <button
            type="button"
            aria-label={t('creator.clearSearch')}
            onClick={() => {
              setQuery('');
              setOpen(false);
              input.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>
      {active && (
        <div
          className="creator-search-results"
          ref={setRoot}
          role="region"
          aria-label={t('creator.searchResults')}
        >
          <p id="creator-search-hint" className="creator-search-hint">
            {t('creator.searchHint')}
          </p>
          {!debouncing && players.map((player) => <SearchResult key={player.id} player={player} />)}
          {(loading || debouncing) && <LoadingIndicator label={t('common.loading')} />}
          {!debouncing && ready && ended && !loading && !players.length && !error && (
            <p className="creator-search-hint" role="status">
              {t('creator.searchEmpty')}
            </p>
          )}
          {!debouncing && error && (
            <div className="creator-error" role="alert">
              <p>{t('creator.searchError')}</p>
              <button
                className="button secondary compact"
                type="button"
                onClick={() => load.current()}
              >
                {t('common.retry')}
              </button>
            </div>
          )}
          <div className="creator-sentinel" ref={setSentinel} />
        </div>
      )}
    </div>
  );
}
