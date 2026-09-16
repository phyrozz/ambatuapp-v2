'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getCharacters, type Character } from '@/lib/characters';
import { CharacterCard, EmptyState } from './cards';
import { ApiLoading } from './api-loading';
import { useI18n } from './i18n-provider';
export function CharacterLibrary() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    void getCharacters()
      .then(setCharacters)
      .catch(() => setError(t('characters.loadError')))
      .finally(() => setLoading(false));
  }, [t]);
  const results = characters.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <label className="search-box character-search">
        <Search size={18} />
        <input
          placeholder={t('characters.searchPlaceholder')}
          aria-label={t('characters.searchLabel')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {loading ? (
        <ApiLoading label={t('characters.loading')} />
      ) : error ? (
        <EmptyState title={t('characters.unavailable')} description={error} />
      ) : results.length ? (
        <div className="character-grid">
          {results.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      ) : (
        <EmptyState title={t('characters.none')} description={t('characters.tryName')} />
      )}
    </>
  );
}
