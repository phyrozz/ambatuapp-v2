'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Gamepad2,
  House,
  UsersRound,
  Play,
  Heart,
  ArrowRight,
  Volume2,
  Square,
  Sparkles,
  UserRound,
  MessageCircle,
} from 'lucide-react';
import { useApp } from './app-provider';
import { useI18n } from './i18n-provider';
import { AdBanner } from './ad-banner';
import { AppSelect, languageFlag } from './app-select';
const nav = [
  { href: '/', key: 'nav.discover', Icon: House },
  { href: '/watch/', key: 'nav.watch', shortKey: 'nav.watchShort', Icon: Play },
  { href: '/lores/', key: 'nav.lore', Icon: BookOpen },
  { href: '/chat/', key: 'nav.chat', Icon: MessageCircle },
  { href: '/games/', key: 'nav.games', shortKey: 'nav.gamesShort', Icon: Gamepad2 },
  { href: '/soundboard/', key: 'nav.soundboard', Icon: AudioLines },
  { href: '/characters/', key: 'nav.characters', Icon: UsersRound },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [topbarHidden, setTopbarHidden] = useState(false);
  const [topbarScrolled, setTopbarScrolled] = useState(false);
  const { current, playing, stop, volume, setVolume, error } = useApp();
  const { locale, locales, localeNames, setLocale, t } = useI18n();
  const adDisabled = path.startsWith('/games/') || path === '/soundboard/' || path === '/chat/' || Boolean(current);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = import('@capacitor/app').then(({ App }) =>
      App.addListener('backButton', () => {
        if (window.location.pathname !== '/') router.back();
        else void App.minimizeApp();
      }),
    );
    return () => {
      void listener.then((l) => l.remove());
    };
  }, [router]);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const nextY = Math.max(0, window.scrollY);
      setTopbarScrolled(nextY > 8);
      if (nextY < 72 || nextY < lastY - 7) setTopbarHidden(false);
      else if (nextY > lastY + 7) setTopbarHidden(true);
      lastY = nextY;
      ticking = false;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    setTopbarHidden(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [path]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return (
    <>
      <a href="#main" className="skip-link">
        {t('shell.skip')}
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            a<span>✳</span>
          </span>
          <span>
            ambatu<span className="orange-text">app</span>
            <small>{t('shell.tagline')}</small>
          </span>
        </Link>
        <p className="nav-label">{t('shell.dailyDose')}</p>
        <nav aria-label={t('shell.mainNavigation')}>
          {nav.map(({ href, key, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${href === '/chat/' ? 'chat-featured' : ''} ${path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{t(key)}</span>
              {href === '/games/' && <small>4</small>}
            </Link>
          ))}
        </nav>
        <div className="nav-divider" />
        <Link className={`nav-item ${path === '/favorites/' ? 'active' : ''}`} href="/favorites/">
          <Heart size={20} />
          {t('nav.favorites')}
        </Link>
        <Link className={`nav-item ${path === '/profile/' ? 'active' : ''}`} href="/profile/">
          <UserRound size={20} />
          {t('nav.profile')}
        </Link>
        <div className="sidebar-bottom">
          <div className="good-vibes">
            <Sparkles size={21} />
            <b>{t('shell.plot')}</b>
            <p>{t('shell.vibes').split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</p>
            <Link href="/games/">
              {t('shell.letsPlay')} <ArrowUpRight size={16} />
            </Link>
          </div>
          <span className="sidebar-credit">
            {t('shell.fanProject')} <span>✳</span>
          </span>
        </div>
      </aside>
      <div className={`workspace ${path === '/chat/' ? 'chat-workspace' : ''}`}>
        <header className={`topbar ${topbarHidden ? 'topbar-hidden' : ''} ${topbarScrolled ? 'topbar-scrolled' : ''}`}>
          <span className="topbar-note">
            <span className="status-dot" /> {t('shell.chaos')}
          </span>
          <Link href="/" className="mobile-brand">
            ambatu<span>app</span> ✳
          </Link>
          <div>
            <div className="language-picker">
              <AppSelect value={locale} onChange={(value) => setLocale(value as typeof locale)}
                ariaLabel={t('language.label')} options={locales.map((item) => ({ value: item, label: localeNames[item], icon: languageFlag(item) }))} />
            </div>
            <Link href="/favorites/" className="icon-button" aria-label={t('nav.favorites')}>
              <Heart size={19} />
            </Link>
            <Link href="/profile/" className={`profile-button ${path.startsWith('/profile/') ? 'active' : ''}`} aria-label={t('nav.profile')}>
              <UserRound size={18} aria-hidden="true" />
              <span className="profile-desktop-label">{t('shell.yourCorner')}</span>
              <span className="profile-mobile-label">{t('nav.profile')}</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <AdBanner disabled={adDisabled || path === '/watch/'} />
        <footer className="footer">
          <span>
            ambatuapp <span className="orange-text">✳</span> {t('shell.stayUnserious')}
          </span>
          <span>{t('shell.community')}</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label={t('shell.mobileNavigation')}>
        {nav.map(({ href, key, shortKey, Icon }) => (
          <Link
            href={href}
            key={href}
            className={`${href === '/chat/' ? 'chat-featured' : ''} ${path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}`}
          >
            <Icon size={21} />
            <span>{t(shortKey ?? key)}</span>
          </Link>
        ))}
      </nav>
      {current && (
        <div className="audio-dock">
          <span className="now-playing">
            <AudioLines size={23} />
            <span>
              <small>{t('audio.nowPlaying')} {playing.length > 1 && `· ${t('audio.sounds', { count: playing.length })}`}</small>
              <b>{current.name}</b>
            </span>
          </span>
          <label className="volume">
            <Volume2 size={19} />
            <input
              aria-label={t('audio.volume')}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(+e.target.value)}
            />
          </label>
          <button className="button dark compact" onClick={stop}>
            <Square size={14} fill="currentColor" />
            {t('audio.stopAll')}
          </button>
        </div>
      )}
      {error && (
        <div className="toast" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  link,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  link?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link href={href} className="text-link">
          {link ?? t('common.exploreAll')}
          <ArrowRight size={17} />
        </Link>
      )}
    </div>
  );
}
