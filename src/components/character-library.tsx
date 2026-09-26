'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getCharacters, type Character } from '@/lib/characters';
import { CharacterCard, EmptyState } from './cards';
import { CharacterLoading } from './character-loading';
import { useI18n } from './i18n-provider';
export function CharacterLibrary() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getCharacters()
      .then((items) => {
        if (active) setCharacters(items);
      })
      .catch(() => {
        if (active) setError(t('characters.loadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
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
        <CharacterLoading label={t('characters.loading')} variant="grid" />
      ) : error ? (
        <EmptyState title={t('characters.unavailable')} description={error} />
      ) : results.length ? (
        <div className="character-grid">
          {results.map((c) => (
            <CharacterCard key={c.id} character={c} featured />
          ))}
        </div>
      ) : (
        <EmptyState title={t('characters.none')} description={t('characters.tryName')} />
      )}
    </>
  );
}
