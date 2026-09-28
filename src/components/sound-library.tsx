'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, Shuffle, Square } from 'lucide-react';
import type { Sound } from '@/lib/catalog';
import { LoadingIndicator } from './loading-indicator';
import { useApp } from './app-provider';
import { SoundCard, EmptyState } from './cards';
import { useI18n } from './i18n-provider';
import { SortPicker } from './sort-picker';

type SoundSort = 'mostPlayed' | 'dateAdded' | 'alphabetically';

export function SoundLibrary({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('__all__');
  const [sort, setSort] = useState<SoundSort>('mostPlayed');
  const loadMoreSentinel = useRef<HTMLDivElement>(null);
  const { favorites, play, stop, playing, sounds, soundCatalogStatus, soundCatalogHasMore, soundCatalogLoadingMore, soundCatalogMoreError, loadMoreSounds, refreshSoundCatalog } = useApp();
  const { t } = useI18n();
  const categories = [...new Set(sounds.map((sound) => sound.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filtered = sounds.filter(
    (s) =>
      (!favoritesOnly || favorites.includes(s.id)) &&
      (category === '__all__' || s.category === category) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
  const sortKeys: Record<SoundSort, string> = {
    mostPlayed: 'sounds.sortMostPlayed',
    dateAdded: 'sounds.sortDateAdded',
    alphabetically: 'sounds.sortAlphabetically',
  };
  const sorted = [...filtered].sort((a, b) => compareSounds(a, b, favoritesOnly ? 'alphabetically' : sort));

  useEffect(() => {
    const sentinel = loadMoreSentinel.current;
    if (soundCatalogStatus !== 'ready' || !soundCatalogHasMore || soundCatalogLoadingMore || soundCatalogMoreError || !sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMoreSounds();
      }
    }, { rootMargin: '300px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreSounds, soundCatalogHasMore, soundCatalogLoadingMore, soundCatalogMoreError, soundCatalogStatus]);

  return (
    <>
      <div className="library-toolbar">
        <label className="search-box">
          <Search size={19} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('sounds.searchPlaceholder')}
            aria-label={t('sounds.searchLabel')}
          />
        </label>
        <div className="toolbar-actions">
          {!favoritesOnly && <SortPicker value={sort} onChange={setSort} options={Object.entries(sortKeys).map(([value, key]) => ({ value: value as SoundSort, label: t(key) }))} disabled={!filtered.length} buttonLabel={t('sounds.sortButton')} />}
          <button
            className="button secondary compact"
            disabled={!filtered.length}
            onClick={() => play(filtered[Math.floor(Math.random() * filtered.length)])}
          >
            <Shuffle size={16} />
            {t('sounds.surprise')}
          </button>
          <button className="button dark compact" disabled={!playing.length} onClick={stop}>
            <Square size={13} />
            {t('audio.stopAll')}
          </button>
        </div>
      </div>
      <div className="filter-row">
        {[{ id: '__all__', label: t('sounds.all') }, ...categories.map((name) => ({ id: name, label: name === 'Classics' ? t('sounds.classics') : name === 'Remixes' ? t('sounds.remixes') : name === 'The crew' ? t('sounds.crew') : name }))].map(({ id, label }) => (
          <button
            className={`filter ${category === id ? 'selected' : ''}`}
            key={id}
            onClick={() => setCategory(id)}
            aria-pressed={category === id}
          >
            {label}
          </button>
        ))}
      </div>
      {soundCatalogStatus === 'loading' ? (
        <div className="sound-catalog-loading">
          <LoadingIndicator label={t('sounds.loadingCatalog')} className="sound-catalog-spinner" />
        </div>
      ) : soundCatalogStatus === 'error' ? (
        <div className="empty-state">
          <h3>{t('sounds.catalogUnavailable')}</h3>
          <button className="button secondary compact" type="button" onClick={refreshSoundCatalog}>{t('sounds.retryCatalog')}</button>
        </div>
      ) : filtered.length || soundCatalogHasMore ? (
        <>
          <div className="sound-grid sound-library">
            {sorted.map((s, i) => (
              <SoundCard key={s.id} sound={s} index={i} showPlayCount={!favoritesOnly} />
            ))}
            {soundCatalogHasMore && <div ref={loadMoreSentinel} className="sound-library-load-more-sentinel">
              {soundCatalogLoadingMore && <LoadingIndicator label={t('common.loading')} compact />}
              {soundCatalogMoreError && <button type="button" className="button secondary compact" onClick={() => { void loadMoreSounds(); }}>{t('sounds.retryCatalog')}</button>}
            </div>}
          </div>
        </>
      ) : (
        <EmptyState
          title={favoritesOnly && !favorites.length ? t('sounds.favoritesEmpty') : sounds.length ? t('sounds.none') : t('sounds.noPublishedSounds')}
          description={favoritesOnly && !favorites.length ? t('sounds.favoritesHint') : sounds.length ? t('sounds.searchHint') : ''}
        />
      )}
    </>
  );
}

function compareSounds(a: Sound, b: Sound, sort: SoundSort) {
  const alphabetically = () => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (sort === 'alphabetically') return alphabetically();
  if (sort === 'dateAdded') {
    const dateDifference = (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0);
    return dateDifference || alphabetically();
  }
  return b.playCount - a.playCount || alphabetically();
}
