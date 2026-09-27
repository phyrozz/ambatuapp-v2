'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, Shuffle, SlidersHorizontal, Square, X } from 'lucide-react';
import type { Sound } from '@/lib/catalog';
import { LoadingIndicator } from './loading-indicator';
import { useApp } from './app-provider';
import { SoundCard, EmptyState } from './cards';
import { useI18n } from './i18n-provider';

type SoundSort = 'mostPlayed' | 'dateAdded' | 'alphabetically';

export function SoundLibrary({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('__all__');
  const [sort, setSort] = useState<SoundSort>('mostPlayed');
  const [sortOpen, setSortOpen] = useState(false);
  const sortButton = useRef<HTMLButtonElement>(null);
  const sortDialog = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (!sortOpen) return;
    const close = () => {
      setSortOpen(false);
      sortButton.current?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !sortDialog.current) return;
      const focusable = [...sortDialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    sortDialog.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sortOpen]);

  function closeSortDialog() {
    setSortOpen(false);
    sortButton.current?.focus();
  }

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
          {!favoritesOnly && <button
            ref={sortButton}
            type="button"
            className="button secondary compact sound-sort-trigger"
            disabled={!filtered.length}
            onClick={() => setSortOpen(true)}
            aria-label={t('sounds.sortButton')}
            aria-haspopup="dialog"
            aria-expanded={sortOpen}
          >
            <SlidersHorizontal size={16} />
            {t(sortKeys[sort])}
          </button>}
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
      {sortOpen && <div className="sound-sort-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSortDialog(); }}>
        <section className="sound-sort-dialog" ref={sortDialog} role="dialog" aria-modal="true" aria-labelledby="sound-sort-title">
          <header><h2 id="sound-sort-title">{t('sounds.sortDialogTitle')}</h2><button type="button" className="sound-sort-close" onClick={closeSortDialog} aria-label={t('sounds.closeSortDialog')}><X size={18}/></button></header>
          <fieldset>
            <legend className="sr-only">{t('sounds.sortDialogTitle')}</legend>
            {(['mostPlayed', 'dateAdded', 'alphabetically'] as const).map((value) => <label key={value} className="sound-sort-option">
              <input autoFocus={sort === value} type="radio" name="sound-sort" value={value} checked={sort === value} onChange={() => { setSort(value); closeSortDialog(); }} />
              <span>{t(sortKeys[value])}</span>
            </label>)}
          </fieldset>
        </section>
      </div>}
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
