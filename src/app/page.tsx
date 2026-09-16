'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, AudioLines, Gamepad2, Sparkles, Play } from 'lucide-react';
import { games, sounds } from '@/lib/catalog';
import { getCharacters, type Character } from '@/lib/characters';
import { GameCard, SoundCard, CharacterCard } from '@/components/cards';
import { SectionHeading } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
export default function Home() {
  const { t } = useI18n();
  const [characters, setCharacters] = useState<Character[]>([]);
  useEffect(() => { void getCharacters().then(setCharacters).catch(() => {}); }, []);
  return (
    <div className="page home-page">
      <div className="welcome">
        <p className="eyebrow">
          <span className="tiny-star">✳</span> {t('home.welcome')}
        </p>
        <span className="edition">{t('home.edition')}</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">
            <span />
            {t('home.goodVibes')}
          </span>
          <h1>
            <span className="hero-line">{t('home.hero1')}</span>
            <span className="hero-line">{t('home.hero2')}</span>
            <span className="hero-line hero-punch">
              ambafun.<span className="hero-asterisk">✳</span>
            </span>
          </h1>
          <p>{t('home.heroBody')}</p>
          <div className="hero-actions">
            <Link href="/games/" className="button dark">
              <Gamepad2 size={20} />
              {t('shell.letsPlay')}
              <ArrowUpRight size={19} />
            </Link>
            <Link href="/soundboard/" className="hero-secondary">
              {t('home.soundboardCta')}
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="hero-foot">
            <span className="mini-avatars">
              {characters.slice(0, 3).map((c) => (
                <img key={c.id} src={c.image} alt="" />
              ))}
            </span>
            <span>{t('home.playground')}</span>
          </div>
        </div>
        <div className="hero-visual">
          <span className="orbit-text">{t('home.classic')}</span>
          <div className="hero-photo">
            <img src="/assets/dreamy_smiling.jpg" alt="Dreamybull smiling" />
            <div>
              <span>{t('home.original')}</span>
              <b>
                Dreamybull <span>↗</span>
              </b>
            </div>
          </div>
          <span className="hero-sticker sticker-top">
            <Sparkles size={18} /> {t('home.mainEnergy')}
          </span>
          <span className="hero-sticker sticker-bottom">
            <AudioLines size={22} /> {t('home.youKnow')}
          </span>
          <span className="doodle">✦</span>
          <span className="hero-caption">{t('home.groupChat')}</span>
        </div>
      </section>
      {/* <div className="ticker">
        <span>{t('home.tickerGang')}</span>
        <span>✳</span>
        <span>{t('home.tickerRepeat')}</span>
        <span>✳</span>
        <span>{t('home.tickerHistory')}</span>
        <span>✳</span>
        <span>{t('home.tickerEnergy')}</span>
        <span>✳</span>
      </div> */}
      <section className="section">
        <SectionHeading
          eyebrow={t('home.gamesEyebrow')}
          title={t('home.gamesTitle')}
          href="/games/"
          link={t('home.allGames')}
        />
        <div className="game-grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>
      <section className="section sound-section">
        <SectionHeading
          eyebrow={t('home.soundsEyebrow')}
          title={t('home.soundsTitle')}
          href="/soundboard/"
          link={t('home.openSoundboard')}
        />
        <div className="sound-grid">
          {[sounds[0], sounds[2], sounds[15], sounds[25]].map((sound, i) => (
            <SoundCard key={sound.id} sound={sound} index={i} />
          ))}
        </div>
        <p className="section-footnote">
          <AudioLines size={14} /> {t('home.soundHint')}
        </p>
      </section>
      <section className="section">
        <SectionHeading
          eyebrow={t('home.legendsEyebrow')}
          title={t('home.legendsTitle')}
          href="/characters/"
          link={t('home.wholeCrew')}
        />
        <div className="character-grid home-characters">
          {[
            characters[0],
            ...characters.filter((c) => ['yes_king', 'kakangku', 'nissan', 'bunda'].includes(c.id)),
          ].filter((c): c is Character => Boolean(c)).map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      </section>
      <Link href="/watch/" className="watch-banner">
        <span className="watch-icon">
          <Play size={27} fill="currentColor" />
        </span>
        <div>
          <p className="eyebrow">{t('home.rabbitHole')}</p>
          <h2>{t('home.clipTitle')}</h2>
          <p>{t('home.clipBody')}</p>
        </div>
        <span className="button dark">
          {t('home.exploreVideos')}
          <ArrowUpRight size={19} />
        </span>
      </Link>
    </div>
  );
}
