'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, AudioLines, BookOpen, Gamepad2, House, LayoutGrid, MessageCircle, Play, Smartphone, UserRound, UsersRound, Heart, Sparkles } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { useFriendRequests } from '@/components/friend-request-provider';
import { openExternal } from '@/lib/native';
const studioUrl = 'https://studio.ambatu.fun/';
const primaryPages = [
  {
    href: '/lores/',
    key: 'nav.lore',
    description: 'lore.description',
    className: 'lore',
    Icon: BookOpen,
  },
  {
    href: '/characters/',
    key: 'nav.characters',
    description: 'characters.description',
    className: 'characters',
    Icon: UsersRound,
  },
  {
    href: '/games/',
    key: 'nav.games',
    description: 'games.description',
    className: 'games',
    Icon: Gamepad2,
  },
];
const pages = [
  { href: '/friends/', key: 'friends.title', Icon: UsersRound },
  { href: '/profile/', key: 'nav.profile', Icon: UserRound },
  { href: '/watch/', key: 'nav.watch', Icon: Play },
  { href: '/soundboard/', key: 'nav.soundboard', Icon: AudioLines },
  { href: '/favorites/', key: 'nav.favorites', Icon: Heart },
  { href: '/?home=1', key: 'nav.discover', Icon: House },
];
export default function ExplorePage() {
  const { t } = useI18n();
  const { incomingCount } = useFriendRequests();
  const [studioDialogOpen, setStudioDialogOpen] = useState(false);
  const studioDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = studioDialogRef.current;
    if (!dialog) return;
    if (studioDialogOpen && !dialog.open) dialog.showModal();
    else if (!studioDialogOpen && dialog.open) dialog.close();
  }, [studioDialogOpen]);

  return <section className="page explore-page">
    <header className="explore-intro"><span className="explore-mark" aria-hidden="true"><LayoutGrid size={20} /></span><p className="eyebrow">{t('nav.explore')}</p><h1>{t('explore.title')}<span className="orange-text">.</span></h1><p>{t('explore.description')}</p></header>
    <nav aria-label={t('explore.title')}>
      <div className="explore-major-grid">
        {primaryPages.map(({ href, key, description, className, Icon }, index) => (
          <Link className={`explore-major-link explore-major-${className}`} href={href} key={href} style={{ '--card-index': index } as React.CSSProperties}>
            <span className="explore-major-icon"><Icon size={23} /></span>
            <span className="explore-major-copy"><strong>{t(key)}</strong><span>{t(description)}</span></span>
            <Icon className="explore-major-art" size={118} aria-hidden="true" />
            <ArrowUpRight className="explore-major-arrow" size={21} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <div className="explore-featured">
        <Link className="explore-feature explore-feature-scroll" href="/scroll/"><span className="explore-feature-icon"><Smartphone size={25} /></span><span className="explore-feature-art" aria-hidden="true"><Play size={68} fill="currentColor" /></span><span className="explore-feature-copy"><span className="eyebrow">{t('nav.watch')}</span><strong>{t('nav.scroll')}</strong><span>{t('scroll.hint')}</span></span><ArrowUpRight className="explore-feature-arrow" size={23} /></Link>
        <Link className="explore-feature explore-feature-chat" href="/chat/"><span className="explore-feature-icon"><MessageCircle size={25} /></span><span className="explore-feature-copy"><span className="eyebrow">{t('nav.chat')}</span><strong>{t('nav.chat')}</strong><span>{t('friends.description')}</span></span><ArrowUpRight className="explore-feature-arrow" size={23} /></Link>
      </div>
      <div className="explore-grid">{pages.map(({ href, key, Icon }, index) => <Link className="explore-card" href={href} key={href} style={{ '--card-index': index } as React.CSSProperties}><span className="explore-card-icon"><Icon size={24} /></span><span>{t(key)}</span>{href === '/friends/' && incomingCount > 0 && <span className="explore-friend-count" aria-label={t('friends.requestCount', { count: incomingCount })}>{incomingCount > 99 ? '99+' : incomingCount}</span>}<ArrowUpRight className="explore-card-arrow" size={17} aria-hidden="true" /></Link>)}
        <button type="button" className="explore-card explore-card-studio" onClick={() => setStudioDialogOpen(true)} aria-haspopup="dialog" aria-expanded={studioDialogOpen}>
          <span className="explore-card-icon"><Sparkles size={24} /></span><span>{t('explore.studio')}</span><ArrowUpRight className="explore-card-arrow" size={17} aria-hidden="true" />
        </button>
      </div>
    </nav>
    <dialog ref={studioDialogRef} className="explore-studio-dialog" aria-labelledby="explore-studio-title" aria-describedby="explore-studio-description" onClick={event => { if (event.target === event.currentTarget) setStudioDialogOpen(false); }} onClose={() => setStudioDialogOpen(false)}>
      <span className="explore-studio-dialog-icon" aria-hidden="true"><Sparkles size={22} /></span>
      <h2 id="explore-studio-title">{t('explore.studioConfirmTitle')}</h2>
      <p id="explore-studio-description">{t('explore.studioConfirmDescription')}</p>
      <div className="explore-studio-dialog-actions">
        <button type="button" className="button secondary" onClick={() => setStudioDialogOpen(false)}>{t('explore.studioCancel')}</button>
        <button type="button" className="button dark" onClick={() => { setStudioDialogOpen(false); void openExternal(studioUrl); }}>{t('explore.studioContinue')}<ArrowUpRight size={17} aria-hidden="true" /></button>
      </div>
    </dialog>
  </section>;
}
