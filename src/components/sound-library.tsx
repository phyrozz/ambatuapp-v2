'use client';
import { useState } from 'react';
import { Search, Shuffle, Square } from 'lucide-react';
import { sounds } from '@/lib/catalog';
import { useApp } from './app-provider';
import { SoundCard, EmptyState } from './cards';
import { useI18n } from './i18n-provider';
export function SoundLibrary({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All sounds');
  const { favorites, play, stop, playing } = useApp();
  const { t } = useI18n();
  const filtered = sounds.filter(
    (s) =>
      (!favoritesOnly || favorites.includes(s.id)) &&
      (category === 'All sounds' || s.category === category) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
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
        {['All sounds', 'Classics', 'Remixes', 'The crew'].map((c) => (
          <button
            className={`filter ${category === c ? 'selected' : ''}`}
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
          >
            {t(c === 'All sounds' ? 'sounds.all' : c === 'Classics' ? 'sounds.classics' : c === 'Remixes' ? 'sounds.remixes' : 'sounds.crew')}
          </button>
        ))}
        <span>{t('sounds.count', { count: filtered.length })}</span>
      </div>
      {filtered.length ? (
        <div className="sound-grid sound-library">
          {filtered.map((s, i) => (
            <SoundCard key={s.id} sound={s} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            favoritesOnly && !favorites.length ? t('sounds.favoritesEmpty') : t('sounds.none')
          }
          description={
            favoritesOnly && !favorites.length
              ? t('sounds.favoritesHint')
              : t('sounds.searchHint')
          }
        />
      )}
    </>
  );
}
