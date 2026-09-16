'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { EmptyState, SoundCard } from './cards';
import { sounds } from '@/lib/catalog';
import { getCharacter, type Character } from '@/lib/characters';
import { ApiLoading } from './api-loading';

export function CharacterDetail({ id }: { id: string }) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    void getCharacter(id).then(setCharacter).catch(() => { setError('Could not load this character. Please try again.'); setCharacter(null); });
  }, [id]);
  if (character === undefined) return <div className="page"><ApiLoading label="Loading the legend…" /></div>;
  if (!character) return <div className="page"><Link href="/characters/" className="back-link"><ArrowLeft size={17} />The whole crew</Link><EmptyState title={error ? 'Character archive unavailable.' : 'Legend not found.'} description={error || 'This character is not in the archive.'} /></div>;
  const related = character.soundIds.length ? sounds.filter((sound) => character.soundIds.includes(sound.id)).slice(0, 4) : [];
  return <div className="page"><Link href="/characters/" className="back-link"><ArrowLeft size={17} />The whole crew</Link><section className="character-detail">{character.header && <img className="character-cover" src={character.header} alt="" />}<div className="character-profile">{character.image && <img src={character.image} alt={character.name} />}<div><p className="eyebrow">AMBATUVERSE ORIGINAL</p><h1>{character.name}</h1></div></div><div className="character-bio"><p className="eyebrow">FROM THE ARCHIVE</p>{character.description.length ? <><div className="lore-label">Community meme lore · fictional and satirical</div>{character.description.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</> : <p>A familiar face from the Ambatuverse character collection.</p>}{character.links.length > 0 && <div className="hero-actions">{character.links.map((url, index) => <a href={url} target="_blank" rel="noopener noreferrer" className="button secondary compact" key={url}>{index === 0 ? 'Original profile' : 'More links'}<ArrowUpRight size={16} /></a>)}</div>}</div></section>{related.length > 0 && <section className="section"><h2>The signature sounds.</h2><div className="sound-grid">{related.map((sound, index) => <SoundCard key={sound.id} sound={sound} index={index} />)}</div></section>}</div>;
}
