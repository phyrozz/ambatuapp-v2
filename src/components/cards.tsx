'use client';
import Link from 'next/link';
import { ArrowUpRight, Heart, Play, Square, AudioLines, Gamepad2 } from 'lucide-react';
import { games, type Sound } from '@/lib/catalog';
import type { Character } from '@/lib/characters';
import { useApp } from './app-provider';
import { useI18n } from './i18n-provider';
export function GameCard({ game }: { game: (typeof games)[number] }) {
  const { t } = useI18n();
  return (
    <Link href={`/games/${game.id}/`} className={`game-card ${game.color}`}>
      <div className={`game-art art-${game.id}`}>
        <GameArtwork id={game.id} />
        <span className="game-tag">{t(`game.${game.id}.tag`)}</span>
        <span className="game-launch">
          <ArrowUpRight size={22} />
        </span>
      </div>
      <div className="game-info">
        <small>
          <Gamepad2 size={13} />
          {t(`game.${game.id}.category`)}
        </small>
        <h3>{game.name}</h3>
        <p>{t(`game.${game.id}.description`)}</p>
      </div>
    </Link>
  );
}
function GameArtwork({ id }: { id: string }) {
  if (id === 'ambatutap')
    return (
      <div className="tap-art" aria-hidden="true">
        <span className="tap-ring" />
        <img src="/assets/dreamy_smiling.jpg" alt="" />
        <b>+20</b>
        <span className="tap-cursor">↖</span>
        <i>✦</i>
      </div>
    );
  if (id === 'ambatusnake')
    return (
      <div className="snake-art" aria-hidden="true">
        <div className="snake-bend" />
        <div className="snake-head">
          <img src="/assets/dreamy_face.jpg" alt="" />
        </div>
        <span className="snake-food">✳</span>
        <span className="snake-dot" />
      </div>
    );
  if (id === 'ambatublou')
    return (
      <div className="mine-art" aria-hidden="true">
        {['', '1', '', '⚑', '', '1', '✹', '2', '', '', '2', '', '', '', '', ''].map((s, i) => (
          <span key={i} className={s === '✹' ? 'art-bomb' : s ? 'art-open' : ''}>
            {s}
          </span>
        ))}
      </div>
    );
  return (
    <div className="flappy-art" aria-hidden="true">
      <span className="art-cloud" />
      <span className="art-pipe pipe-one" />
      <img src="/assets/images/bird_1.png" alt="" />
      <span className="art-pipe pipe-two" />
      <span className="art-ground" />
    </div>
  );
}
export function SoundCard({ sound, index = 0 }: { sound: Sound; index?: number }) {
  const { play, playing, favorites, toggleFavorite } = useApp();
  const { t } = useI18n();
  const active = playing.includes(sound.id);
  return (
    <article className={`sound-card sound-color-${sound.color} ${active ? 'is-playing' : ''}`}>
      <div className="sound-top">
        <span className="sound-number">{String(index + 1).padStart(2, '0')}</span>
        <button
          className={`favorite-button ${favorites.includes(sound.id) ? 'selected' : ''}`}
          aria-label={`${t(favorites.includes(sound.id) ? 'common.unfavorite' : 'common.favorite')} ${sound.name}`}
          aria-pressed={favorites.includes(sound.id)}
          onClick={() => toggleFavorite(sound.id)}
        >
          <Heart size={17} fill={favorites.includes(sound.id) ? 'currentColor' : 'none'} />
        </button>
      </div>
      <button
        className="sound-play"
        onClick={() => play(sound)}
        aria-label={`${t(active ? 'common.stop' : 'common.play')} ${sound.name}`}
      >
        <span className="waveform" aria-hidden="true">
          {[12, 23, 16, 30, 21, 36, 18, 29, 14, 24, 11, 19].map((h, i) => (
            <i key={i} style={{ height: h, animationDelay: `${i * 0.08}s` }} />
          ))}
        </span>
        <span className="sound-caption">
          <span>
            <b>{sound.name}</b>
            <small>{t(sound.category === 'Classics' ? 'sounds.classics' : sound.category === 'Remixes' ? 'sounds.remixes' : 'sounds.crew')}</small>
          </span>
          <span className="round-play">
            {active ? (
              <Square size={14} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </span>
        </span>
      </button>
    </article>
  );
}
export function CharacterCard({ character }: { character: Character }) {
  const { t } = useI18n();
  return (
    <Link className="character-card" href={`/characters/${character.id}/`}>
      <div>
        {character.image && <img src={character.image} alt={character.name} />}
        <span className="character-arrow">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <h3>{character.name}</h3>
      <p>{t(character.id === 'dreamy' ? 'games.startedIt' : 'games.meetLegend')}</p>
    </Link>
  );
}
export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <AudioLines size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
