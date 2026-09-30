'use client';
import Link from 'next/link';
import { ArrowUpRight, AudioLines, BookOpen, Gamepad2, House, LayoutGrid, MessageCircle, Play, Smartphone, UserRound, UsersRound, Heart } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { useFriendRequests } from '@/components/friend-request-provider';
const pages = [
  { href: '/friends/', key: 'friends.title', Icon: UsersRound },
  { href: '/lores/', key: 'nav.lore', Icon: BookOpen },
  { href: '/games/', key: 'nav.games', Icon: Gamepad2 },
  { href: '/profile/', key: 'nav.profile', Icon: UserRound },
  { href: '/watch/', key: 'nav.watch', Icon: Play },
  { href: '/soundboard/', key: 'nav.soundboard', Icon: AudioLines },
  { href: '/characters/', key: 'nav.characters', Icon: UsersRound },
  { href: '/favorites/', key: 'nav.favorites', Icon: Heart },
  { href: '/?home=1', key: 'nav.discover', Icon: House },
];
export default function ExplorePage() {
  const { t } = useI18n();
  const { incomingCount } = useFriendRequests();
  return <section className="page explore-page">
    <header className="explore-intro"><span className="explore-mark" aria-hidden="true"><LayoutGrid size={20} /></span><p className="eyebrow">{t('nav.explore')}</p><h1>{t('explore.title')}<span className="orange-text">.</span></h1><p>{t('explore.description')}</p></header>
    <nav aria-label={t('explore.title')}>
      <div className="explore-featured">
        <Link className="explore-feature explore-feature-scroll" href="/scroll/"><span className="explore-feature-icon"><Smartphone size={25} /></span><span className="explore-feature-art" aria-hidden="true"><Play size={68} fill="currentColor" /></span><span className="explore-feature-copy"><span className="eyebrow">{t('nav.watch')}</span><strong>{t('nav.scroll')}</strong><span>{t('scroll.hint')}</span></span><ArrowUpRight className="explore-feature-arrow" size={23} /></Link>
        <Link className="explore-feature explore-feature-chat" href="/chat/"><span className="explore-feature-icon"><MessageCircle size={25} /></span><span className="explore-feature-copy"><span className="eyebrow">{t('nav.chat')}</span><strong>{t('nav.chat')}</strong><span>{t('friends.description')}</span></span><ArrowUpRight className="explore-feature-arrow" size={23} /></Link>
      </div>
      <div className="explore-grid">{pages.map(({ href, key, Icon }, index) => <Link className="explore-card" href={href} key={href} style={{ '--card-index': index } as React.CSSProperties}><span className="explore-card-icon"><Icon size={24} /></span><span>{t(key)}</span>{href === '/friends/' && incomingCount > 0 && <span className="explore-friend-count" aria-label={t('friends.requestCount', { count: incomingCount })}>{incomingCount > 99 ? '99+' : incomingCount}</span>}<ArrowUpRight className="explore-card-arrow" size={17} aria-hidden="true" /></Link>)}</div>
    </nav>
  </section>;
}
