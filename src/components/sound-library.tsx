'use client';
import { useState } from 'react';
import { Search, Shuffle, Square } from 'lucide-react';
import { sounds } from '@/lib/catalog';
import { useApp } from './app-provider';
import { SoundCard, EmptyState } from './cards';
export function SoundLibrary({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All sounds');
  const { favorites, play, stop, playing } = useApp();
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
            placeholder="Find your favorite sound…"
            aria-label="Search sounds"
          />
        </label>
        <div className="toolbar-actions">
          <button
            className="button secondary compact"
            disabled={!filtered.length}
            onClick={() => play(filtered[Math.floor(Math.random() * filtered.length)])}
          >
            <Shuffle size={16} />
            Surprise me
          </button>
          <button className="button dark compact" disabled={!playing.length} onClick={stop}>
            <Square size={13} />
            Stop all
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
            {c}
          </button>
        ))}
        <span>{filtered.length} sounds</span>
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
            favoritesOnly && !favorites.length ? 'Your favorites start here.' : 'No sounds found.'
          }
          description={
            favoritesOnly && !favorites.length
              ? 'Tap the heart on any sound to keep it in your personal collection.'
              : 'Try another search or category.'
          }
        />
      )}
    </>
  );
}
