'use client';
import { Play, Square } from 'lucide-react';
import type { Sound } from '@/lib/catalog';
import { useApp } from './app-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';

export function SoundPlayback({
  sound,
  showPlayCount = false,
  preview = false,
  heading = false,
}: {
  sound: Sound;
  showPlayCount?: boolean;
  preview?: boolean;
  heading?: boolean;
}) {
  const { play, playing, loadingSounds } = useApp();
  const { t } = useI18n();
  const active = playing.includes(sound.id);
  const loading = loadingSounds.includes(sound.id);
  const category =
    sound.category === 'Classics'
      ? t('sounds.classics')
      : sound.category === 'Remixes'
        ? t('sounds.remixes')
        : sound.category === 'The crew'
          ? t('sounds.crew')
          : sound.category;
  return (
    <button
      className={`sound-play ${active ? 'is-playing' : ''} ${loading ? 'is-loading' : ''}`}
      type="button"
      onClick={() => play(sound, { preview })}
      aria-label={`${t(loading ? 'common.loading' : active ? 'common.stop' : 'common.play')} ${sound.name}`}
      aria-busy={loading}
    >
      <span className="waveform" aria-hidden="true">
        {[12, 23, 16, 30, 21, 36, 18, 29, 14, 24, 11, 19].map((h, i) => (
          <i key={i} style={{ height: h, animationDelay: `${i * 0.08}s` }} />
        ))}
      </span>
      <span className="sound-caption">
        <span className="sound-card-copy">
          {heading ? (
            <span className="sound-preview-title" role="heading" aria-level={3}>
              {sound.name}
            </span>
          ) : (
            <b>{sound.name}</b>
          )}
          <small>{category}</small>
          {showPlayCount && (
            <small className="sound-play-count">
              {t(sound.playCount === 1 ? 'sounds.playCountSingular' : 'sounds.playCountPlural', {
                count: sound.playCount,
              })}
            </small>
          )}
        </span>
        <span className="round-play">
          {loading ? (
            <LoadingIndicator label={t('common.loading')} compact />
          ) : active ? (
            <Square size={14} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </span>
      </span>
    </button>
  );
}
