'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getCharacters, type Character } from '@/lib/characters';
import { CharacterCard, EmptyState } from './cards';
import { ApiLoading } from './api-loading';
export function CharacterLibrary() {
  const [q, setQ] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    void getCharacters()
      .then(setCharacters)
      .catch(() => setError('Could not load the character archive. Please try again.'))
      .finally(() => setLoading(false));
  }, []);
  const results = characters.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <label className="search-box character-search">
        <Search size={18} />
        <input
          placeholder="Find a legend…"
          aria-label="Search characters"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {loading ? (
        <ApiLoading label="Loading the crew…" />
      ) : error ? (
        <EmptyState title="Character archive unavailable." description={error} />
      ) : results.length ? (
        <div className="character-grid">
          {results.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      ) : (
        <EmptyState title="No legends found." description="Try a different name." />
      )}
    </>
  );
}
