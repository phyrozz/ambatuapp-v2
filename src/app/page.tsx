'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowBigDown, ArrowBigUp, ArrowRight, ArrowUpRight, AudioLines, BookOpen, MessageCircle, Play, Sparkles } from 'lucide-react';
import { games } from '@/lib/catalog';
import { getCharacters, type Character } from '@/lib/characters';
import { GameCard, SoundCard, CharacterCard } from '@/components/cards';
import { SectionHeading } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useApp } from '@/components/app-provider';
import { LoadingIndicator } from '@/components/loading-indicator';
const apiBase = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? '';
export default function Home() {
  const { t } = useI18n();
  const { sounds } = useApp();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [communityVideos, setCommunityVideos] = useState<Array<{ id: string; title: string; thumbnailUrl: string; upvotes: number; downvotes: number; commentCount: number }>>([]);
  const [topLores, setTopLores] = useState<Array<{ id: string; title: string; text: string; imageUrls: string[]; upvotes: number; downvotes: number; commentCount: number }>>([]);
  const [communityVideosLoading, setCommunityVideosLoading] = useState(Boolean(apiBase));
  const [topLoresLoading, setTopLoresLoading] = useState(Boolean(apiBase));
  useEffect(() => { void getCharacters().then(setCharacters).catch(() => {}); }, []);
  useEffect(() => {
    if (!apiBase) return;
    const controller = new AbortController();
    fetch(`${apiBase}/videos?sort=upvotes&limit=5`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setCommunityVideos(data?.videos ?? []); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setCommunityVideosLoading(false); });
    fetch(`${apiBase}/lores?sort=upvotes`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setTopLores((data?.lores ?? []).slice(0, 5)); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setTopLoresLoading(false); });
    return () => controller.abort();
  }, []);
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
        </div>
        <div className="hero-visual">
          <span className="orbit-text">{t('home.classic')}</span>
          <div className="hero-photo">
            <img src="/assets/dreamy_smiling.jpg" alt={t('home.heroImageAlt')} />
            <div>
              <span>{t('home.original')}</span>
              <b>
                {t('home.heroName')} <span>↗</span>
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
      {(communityVideosLoading || topLoresLoading || communityVideos.length > 0 || topLores.length > 0) && <section className="section home-community">
        <SectionHeading eyebrow={t('home.communityEyebrow')} title={t('home.communityTitle')} />
        {(communityVideosLoading || communityVideos.length > 0) && <div className="home-community-block"><div className="home-community-title"><Play size={18}/><h3>{t('home.communityVideos')}</h3><Link href="/watch/">{t('home.exploreCommunityVideos')} <ArrowRight size={16}/></Link></div>{communityVideosLoading ? <div className="module-loading"><LoadingIndicator label={t('watch.loading')} /></div> : <div className="home-community-grid">{communityVideos.map(video => <Link href={`/watch/${video.id}/`} className="home-community-card" key={video.id}>{video.thumbnailUrl && <img src={video.thumbnailUrl} alt=""/>}<b>{video.title}</b><div className="home-community-stats"><span aria-label={`${t('lore.upvote')}: ${video.upvotes}`}><ArrowBigUp size={14} aria-hidden="true"/>{video.upvotes}</span><span aria-label={`${t('lore.downvote')}: ${video.downvotes}`}><ArrowBigDown size={14} aria-hidden="true"/>{video.downvotes}</span><span aria-label={`${t('lore.comments')}: ${video.commentCount}`}><MessageCircle size={14} aria-hidden="true"/>{video.commentCount}</span></div></Link>)}</div>}</div>}
        {(topLoresLoading || topLores.length > 0) && <div className="home-community-block"><div className="home-community-title"><BookOpen size={18}/><h3>{t('home.communityLore')}</h3><Link href="/lores/">{t('home.exploreLore')} <ArrowRight size={16}/></Link></div>{topLoresLoading ? <div className="module-loading"><LoadingIndicator label={t('lore.searchingArchive')} /></div> : <div className="home-community-grid">{topLores.map(lore => <Link href={`/lores/${lore.id}/`} className="home-community-card" key={lore.id}>{lore.imageUrls[0] && <img src={lore.imageUrls[0]} alt=""/>}<b>{lore.title}</b><div className="home-community-stats"><span aria-label={`${t('lore.upvote')}: ${lore.upvotes}`}><ArrowBigUp size={14} aria-hidden="true"/>{lore.upvotes}</span><span aria-label={`${t('lore.downvote')}: ${lore.downvotes}`}><ArrowBigDown size={14} aria-hidden="true"/>{lore.downvotes}</span><span aria-label={`${t('lore.comments')}: ${lore.commentCount}`}><MessageCircle size={14} aria-hidden="true"/>{lore.commentCount}</span></div></Link>)}</div>}</div>}
      </section>}
      <section className="section home-games-section">
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
      <section className="section sound-section home-sounds-section">
        <SectionHeading
          eyebrow={t('home.soundsEyebrow')}
          title={t('home.soundsTitle')}
          href="/soundboard/"
          link={t('home.openSoundboard')}
        />
        {sounds.length > 0 && <div className="sound-grid">
          {sounds.slice(0, 4).map((sound, i) => (
            <SoundCard key={sound.id} sound={sound} index={i} />
          ))}
        </div>}
        <p className="section-footnote">
          <AudioLines size={14} /> {t('home.soundHint')}
        </p>
      </section>
      <section className="section home-characters-section">
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
