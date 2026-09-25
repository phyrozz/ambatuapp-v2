'use client';
import { useState } from 'react';
import { Search, Shuffle, Square } from 'lucide-react';
import { useApp } from './app-provider';
import { SoundCard, EmptyState } from './cards';
import { useI18n } from './i18n-provider';
export function SoundLibrary({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('__all__');
  const { favorites, play, stop, playing, sounds, soundCatalogStatus, refreshSoundCatalog } = useApp();
  const { t } = useI18n();
  const categories = [...new Set(sounds.map((sound) => sound.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filtered = sounds.filter(
    (s) =>
      (!favoritesOnly || favorites.includes(s.id)) &&
      (category === '__all__' || s.category === category) &&
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
        <span>{t('sounds.count', { count: filtered.length })}</span>
      </div>
      {soundCatalogStatus === 'loading' ? (
        <div className="empty-state">
          <h3>{t('sounds.loadingCatalog')}</h3>
        </div>
      ) : soundCatalogStatus === 'error' ? (
        <div className="empty-state">
          <h3>{t('sounds.catalogUnavailable')}</h3>
          <button className="button secondary compact" type="button" onClick={refreshSoundCatalog}>{t('sounds.retryCatalog')}</button>
        </div>
      ) : filtered.length ? (
        <div className="sound-grid sound-library">
          {filtered.map((s, i) => (
            <SoundCard key={s.id} sound={s} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={favoritesOnly && !favorites.length ? t('sounds.favoritesEmpty') : sounds.length ? t('sounds.none') : t('sounds.noPublishedSounds')}
          description={favoritesOnly && !favorites.length ? t('sounds.favoritesHint') : sounds.length ? t('sounds.searchHint') : ''}
        />
      )}
    </>
  );
}
