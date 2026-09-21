'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, AudioLines, Gamepad2, Sparkles, Play, ThumbsUp, BookOpen } from 'lucide-react';
import { games, sounds } from '@/lib/catalog';
import { getCharacters, type Character } from '@/lib/characters';
import { GameCard, SoundCard, CharacterCard } from '@/components/cards';
import { SectionHeading } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
export default function Home() {
  const { t } = useI18n();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [communityVideos, setCommunityVideos] = useState<Array<{ id: string; title: string; thumbnailUrl: string; upvotes: number }>>([]);
  const [topLores, setTopLores] = useState<Array<{ id: string; title: string; text: string; imageUrls: string[]; upvotes: number }>>([]);
  useEffect(() => { void getCharacters().then(setCharacters).catch(() => {}); }, []);
  useEffect(() => { const api = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, ''); if (!api) return; void Promise.all([fetch(`${api}/videos?sort=upvotes&limit=5`).then(r => r.ok ? r.json() : null), fetch(`${api}/lores?sort=upvotes`).then(r => r.ok ? r.json() : null)]).then(([videos, lores]) => { setCommunityVideos(videos?.videos ?? []); setTopLores((lores?.lores ?? []).slice(0, 5)); }).catch(() => {}); }, []);
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
      {(communityVideos.length > 0 || topLores.length > 0) && <section className="section home-community">
        <SectionHeading eyebrow={t('home.communityEyebrow')} title={t('home.communityTitle')} />
        {communityVideos.length > 0 && <div className="home-community-block"><div className="home-community-title"><Play size={18}/><h3>{t('home.communityVideos')}</h3><Link href="/watch/">{t('home.exploreCommunityVideos')} <ArrowRight size={16}/></Link></div><div className="home-community-grid">{communityVideos.map(video => <Link href={`/watch/${video.id}/`} className="home-community-card" key={video.id}>{video.thumbnailUrl && <img src={video.thumbnailUrl} alt=""/>}<b>{video.title}</b><span><ThumbsUp size={14}/>{video.upvotes}</span></Link>)}</div></div>}
        {topLores.length > 0 && <div className="home-community-block"><div className="home-community-title"><BookOpen size={18}/><h3>{t('home.communityLore')}</h3><Link href="/lores/">{t('home.exploreLore')} <ArrowRight size={16}/></Link></div><div className="home-community-grid">{topLores.map(lore => <Link href={`/lores/${lore.id}/`} className="home-community-card" key={lore.id}>{lore.imageUrls[0] && <img src={lore.imageUrls[0]} alt=""/>}<b>{lore.title}</b><span><ThumbsUp size={14}/>{lore.upvotes}</span></Link>)}</div></div>}
      </section>}
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
