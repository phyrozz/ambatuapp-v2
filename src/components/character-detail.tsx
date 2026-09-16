'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { EmptyState, SoundCard } from './cards';
import { sounds } from '@/lib/catalog';
import { getCharacter, type Character } from '@/lib/characters';
import { ApiLoading } from './api-loading';
import { useI18n } from './i18n-provider';

export function CharacterDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const [character, setCharacter] = useState<Character | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    void getCharacter(id).then(setCharacter).catch(() => { setError(t('character.loadError')); setCharacter(null); });
  }, [id, t]);
  if (character === undefined) return <div className="page"><ApiLoading label={t('character.loading')} /></div>;
  if (!character) return <div className="page"><Link href="/characters/" className="back-link"><ArrowLeft size={17} />{t('home.wholeCrew')}</Link><EmptyState title={error ? t('characters.unavailable') : t('character.notFound')} description={error || t('character.notInArchive')} /></div>;
  const related = character.soundIds.length ? sounds.filter((sound) => character.soundIds.includes(sound.id)).slice(0, 4) : [];
  return <div className="page"><Link href="/characters/" className="back-link"><ArrowLeft size={17} />{t('home.wholeCrew')}</Link><section className="character-detail">{character.header && <img className="character-cover" src={character.header} alt="" />}<div className="character-profile">{character.image && <img src={character.image} alt={character.name} />}<div><p className="eyebrow">{t('character.original')}</p><h1>{character.name}</h1></div></div><div className="character-bio"><p className="eyebrow">{t('character.archive')}</p>{character.description.length ? <><div className="lore-label">{t('character.disclaimer')}</div>{character.description.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</> : <p>{t('character.fallback')}</p>}{character.links.length > 0 && <div className="hero-actions">{character.links.map((url, index) => <a href={url} target="_blank" rel="noopener noreferrer" className="button secondary compact" key={url}>{t(index === 0 ? 'common.originalProfile' : 'common.moreLinks')}<ArrowUpRight size={16} /></a>)}</div>}</div></section>{related.length > 0 && <section className="section"><h2>{t('character.sounds')}</h2><div className="sound-grid">{related.map((sound, index) => <SoundCard key={sound.id} sound={sound} index={index} />)}</div></section>}</div>;
}
