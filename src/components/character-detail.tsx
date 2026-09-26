'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { getCharacter, type Character } from '@/lib/characters';
import { CharacterLoading } from './character-loading';
import { EmptyState, SoundCard } from './cards';
import { useApp } from './app-provider';
import { useI18n } from './i18n-provider';

type CharacterResult = {
  id: string;
  character: Character | null;
  error?: string;
};

export function CharacterDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const { sounds } = useApp();
  const [result, setResult] = useState<CharacterResult | null>(null);

  useEffect(() => {
    let active = true;
    void getCharacter(id)
      .then((character) => {
        if (active) setResult({ id, character });
      })
      .catch(() => {
        if (active) setResult({ id, character: null, error: t('character.loadError') });
      });
    return () => { active = false; };
  }, [id, t]);

  const current = result?.id === id ? result : null;
  if (!current) {
    return (
      <div className="page character-detail-page">
        <Link href="/characters/" className="back-link">
          <ArrowLeft size={17} />
          {t('home.wholeCrew')}
        </Link>
        <CharacterLoading label={t('character.loading')} variant="detail" />
      </div>
    );
  }

  if (!current.character) {
    return (
      <div className="page character-detail-page">
        <Link href="/characters/" className="back-link">
          <ArrowLeft size={17} />
          {t('home.wholeCrew')}
        </Link>
        <EmptyState
          title={current.error ? t('characters.unavailable') : t('character.notFound')}
          description={current.error || t('character.notInArchive')}
        />
      </div>
    );
  }

  const character = current.character;
  const related = character.soundIds.length
    ? sounds.filter((sound) => character.soundIds.includes(sound.id)).slice(0, 4)
    : [];

  return (
    <div className="page character-detail-page">
      <Link href="/characters/" className="back-link">
        <ArrowLeft size={17} />
        {t('home.wholeCrew')}
      </Link>

      <section className="character-detail">
        <CharacterCover key={character.id} src={character.header} />

        <div className="character-profile">
          <CharacterPortrait key={character.id} src={character.image} name={character.name} />
          <div className="character-profile-copy">
            <p className="eyebrow">{t('character.original')}</p>
            <h1>{character.name}</h1>
          </div>
        </div>

        <div className="character-bio">
          <p className="eyebrow">{t('character.archive')}</p>
          {character.description.length ? (
            <>
              <div className="lore-label">{t('character.disclaimer')}</div>
              {character.description.map((paragraph, index) => (
                <p key={`${character.id}-${index}`}>{paragraph}</p>
              ))}
            </>
          ) : (
            <p>{t('character.fallback')}</p>
          )}

          {character.links.length > 0 && (
            <div className="character-links">
              {character.links.map((url, index) => (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary compact"
                  key={url}
                >
                  {t(index === 0 ? 'common.originalProfile' : 'common.moreLinks')}
                  <ArrowUpRight size={16} />
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="section character-sounds-section">
          <h2>{t('character.sounds')}</h2>
          <div className="sound-grid">
            {related.map((sound, index) => (
              <SoundCard key={sound.id} sound={sound} index={index} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CharacterCover({ src }: { src?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src && !imageFailed);
  return (
    <div className={`character-cover ${showImage ? '' : 'is-placeholder'}`}>
      {showImage && <img src={src} alt="" onError={() => setImageFailed(true)} />}
    </div>
  );
}

function CharacterPortrait({ src, name }: { src?: string; name: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (src && !imageFailed) {
    return <img src={src} alt={name} onError={() => setImageFailed(true)} />;
  }
  return (
    <span className="character-profile-placeholder" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
