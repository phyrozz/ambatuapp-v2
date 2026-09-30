'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { getCharactersPage, type Character, type CharacterSort } from '@/lib/characters';
import { CharacterCard, EmptyState } from './cards';
import { CharacterLoading } from './character-loading';
import { LoadingIndicator } from './loading-indicator';
import { useI18n } from './i18n-provider';
import { SortPicker } from './sort-picker';

const PAGE_SIZE = 12;

export function CharacterLibrary() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState<CharacterSort>('nameAsc');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  const moreControllerRef = useRef<AbortController | null>(null);
  const moreInFlightRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const generation = ++generationRef.current;
    moreControllerRef.current?.abort();
    moreControllerRef.current = null;
    moreInFlightRef.current = false;
    const controller = new AbortController();
    setCharacters([]);
    setCursor(null);
    setLoading(true);
    setLoadingMore(false);
    setError('');
    setLoadMoreError(false);
    void getCharactersPage({ limit: PAGE_SIZE, query: debouncedQ, sort, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setCharacters(page.characters);
        setCursor(page.nextCursor);
      })
      .catch(() => {
        if (!controller.signal.aborted && generation === generationRef.current) setError(t('characters.loadError'));
      })
      .finally(() => {
        if (!controller.signal.aborted && generation === generationRef.current) setLoading(false);
      });
    return () => {
      controller.abort();
      moreControllerRef.current?.abort();
    };
  }, [debouncedQ, sort, t]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const loadMore = useCallback(async () => {
    if (!cursor || loading || loadingMore || moreInFlightRef.current) return;
    const generation = generationRef.current;
    const controller = new AbortController();
    moreControllerRef.current = controller;
    moreInFlightRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const page = await getCharactersPage({ limit: PAGE_SIZE, cursor, query: debouncedQ, sort, signal: controller.signal });
      if (generation !== generationRef.current) return;
      setCharacters((current) => {
        const knownIds = new Set(current.map((character) => character.id));
        return [...current, ...page.characters.filter((character) => !knownIds.has(character.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      if (!controller.signal.aborted && generation === generationRef.current) setLoadMoreError(true);
    } finally {
      if (moreControllerRef.current === controller) moreControllerRef.current = null;
      if (generation === generationRef.current) {
        moreInFlightRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [cursor, debouncedQ, loading, loadingMore, sort]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (loading || loadingMore || loadMoreError || !cursor || !sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore, loadMoreError, loading, loadingMore]);

  return (
    <>
      <div className="character-toolbar">
        <label className="search-box character-search">
          <Search size={18} />
          <input
            placeholder={t('characters.searchPlaceholder')}
            aria-label={t('characters.searchLabel')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <SortPicker value={sort} onChange={setSort} disabled={!characters.length} options={[{ value: 'nameAsc', label: t('characters.sortNameAscending') }, { value: 'nameDesc', label: t('characters.sortNameDescending') }]} />
      </div>
      {loading ? (
        <CharacterLoading label={t('characters.loading')} variant="grid" />
      ) : error ? (
        <EmptyState title={t('characters.unavailable')} description={error} />
      ) : !characters.length && !cursor ? (
        <EmptyState title={t('characters.none')} description={t('characters.tryName')} />
      ) : (
        <div className="character-grid">
          {characters.map((character) => <CharacterCard key={character.id} character={character} featured />)}
          {cursor && <div ref={sentinelRef} className="character-load-more-sentinel">
            {loadingMore && <LoadingIndicator label={t('common.loading')} compact />}
            {loadMoreError && <div role="alert"><p>{t('characters.loadError')}</p><button className="button secondary compact" type="button" onClick={() => void loadMore()}>{t('common.retry')}</button></div>}
          </div>}
        </div>
      )}
    </>
  );
}
