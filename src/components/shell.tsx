'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
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
  Smartphone,
  LayoutGrid,
} from 'lucide-react';
import { useApp } from './app-provider';
import { useI18n } from './i18n-provider';
import { AdBanner } from './ad-banner';
import { AppSelect, languageFlag } from './app-select';
import { ThemeToggle } from './theme-toggle';
import { useAuth } from './auth-provider';
import { useFriendRequests } from './friend-request-provider';
import { installPushNavigation } from '@/lib/push-notifications';
import { isStandalonePwa, navigateLegalLinkInApp } from '@/lib/legal-navigation';
const nav = [
  { href: '/', key: 'nav.discover', Icon: House },
  { href: '/scroll/', key: 'nav.scroll', Icon: Smartphone },
  { href: '/explore/', key: 'nav.explore', Icon: LayoutGrid },
  { href: '/watch/', key: 'nav.watch', shortKey: 'nav.watchShort', Icon: Play },
  { href: '/lores/', key: 'nav.lore', Icon: BookOpen },
  { href: '/chat/', key: 'nav.chat', Icon: MessageCircle },
  { href: '/games/', key: 'nav.games', shortKey: 'nav.gamesShort', Icon: Gamepad2 },
  { href: '/characters/', key: 'nav.characters', Icon: UsersRound },
  { href: '/soundboard/', key: 'nav.soundboard', Icon: AudioLines },
];
const mobileNav = [
  { href: '/chat/', key: 'nav.chat', Icon: MessageCircle },
  { href: '/lores/', key: 'nav.lore', Icon: BookOpen },
  { href: '/scroll/', key: 'nav.scroll', Icon: Smartphone },
  { href: '/games/', key: 'nav.gamesShort', Icon: Gamepad2 },
  { href: '/explore/', key: 'nav.explore', Icon: LayoutGrid },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const routePath = path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;
  const router = useRouter();
  const [topbarHidden, setTopbarHidden] = useState(false);
  const [topbarScrolled, setTopbarScrolled] = useState(false);
  const { current, playing, stop, volume, setVolume, error } = useApp();
  const { locale, locales, localeNames, setLocale, t } = useI18n();
  const { user } = useAuth();
  const { incomingCount } = useFriendRequests();
  const adDisabled = routePath.startsWith('/games/') || routePath === '/soundboard/' || routePath === '/chat/' || ['/privacy/', '/terms/'].includes(routePath) || Boolean(current);
  useEffect(() => {
    if (path === '/' && isStandalonePwa() && new URLSearchParams(window.location.search).get('home') !== '1') {
      router.replace('/scroll/');
    }
  }, [path, router]);
  useEffect(() => { installPushNavigation(() => null, locale, user?.id ?? null, url => router.push(url)); }, [locale, user?.id, router]);
  const openPwaHomepage = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!isStandalonePwa()) return;
    event.preventDefault();
    router.push('/?home=1');
  };
  const openPrivacyPolicy = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    navigateLegalLinkInApp(event, '/privacy/', href => router.push(href));
  };
  const openTerms = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    navigateLegalLinkInApp(event, '/terms/', href => router.push(href));
  };
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const openNativeDetail = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest('a[href]');
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(anchor.getAttribute('href')!, window.location.href);
      if (url.origin !== window.location.origin) return;
      const match = url.pathname.match(/^\/(watch|lores|characters)\/([^/]+)\/?$/);
      if (!match || match[2] === 'native') return;
      event.preventDefault();
      event.stopPropagation();
      router.push(`/${match[1]}/native/?id=${encodeURIComponent(decodeURIComponent(match[2]))}`);
    };
    document.addEventListener('click', openNativeDetail, true);
    const listener = import('@capacitor/app').then(({ App }) =>
      App.addListener('backButton', () => {
        if (window.location.pathname !== '/') router.back();
        else void App.minimizeApp();
      }),
    );
    const openAppUrl = (url: string) => {
      const incoming = new URL(url);
      if (incoming.protocol !== 'com.example.ambatuapp:' || incoming.host !== 'auth') return;
      void import('@capacitor/browser').then(({ Browser }) => Browser.close()).catch(() => undefined);
      router.replace(`/auth/callback/?${incoming.searchParams.toString()}`);
    };
    const urlListener = import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('appUrlOpen', ({ url }) => openAppUrl(url));
      const launch = await App.getLaunchUrl();
      if (launch?.url) openAppUrl(launch.url);
      return handle;
    });
    return () => {
      document.removeEventListener('click', openNativeDetail, true);
      void listener.then((l) => l.remove());
      void urlListener.then((l) => l.remove());
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
        <div className="brand-block">
          <Link href="/" onClick={openPwaHomepage} className="brand">
            <Image
              src="/app-icon.svg"
              alt=""
              width={40}
              height={40}
              className="brand-mark"
              priority
            />
            <span>
              ambatu<span className="orange-text">app</span>
              <small>{t('shell.tagline')}</small>
            </span>
          </Link>
          <span className="beta-badge">{t('shell.beta')}</span>
        </div>
        <p className="nav-label">{t('shell.dailyDose')}</p>
        <nav aria-label={t('shell.mainNavigation')}>
          {nav.map(({ href, key, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={href === '/' ? openPwaHomepage : undefined}
              className={`nav-item ${routePath === href || (href !== '/' && routePath.startsWith(href)) ? 'active' : ''}`}
              aria-current={routePath === href || (href !== '/' && routePath.startsWith(href)) ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{t(key)}</span>
              {href === '/games/' && <small>4</small>}
              {href === '/explore/' && incomingCount > 0 && <small className="friend-request-count" aria-label={t('friends.requestCount', { count: incomingCount })}>{incomingCount > 99 ? '99+' : incomingCount}</small>}
            </Link>
          ))}
        </nav>
        <div className="nav-divider" />
        {/* <Link className={`nav-item ${path === '/favorites/' ? 'active' : ''}`} href="/favorites/">
          <Heart size={20} />
          {t('nav.favorites')}
        </Link> */}
        <Link className={`nav-item ${routePath === '/profile/' ? 'active' : ''}`} href="/profile/">
          <UserRound size={20} />
          {t('nav.profile')}
        </Link>
        <div className="sidebar-bottom">
          {/* <div className="good-vibes">
            <Sparkles size={21} />
            <b>{t('shell.plot')}</b>
            <p>{t('shell.vibes').split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</p>
            <Link href="/games/">
              {t('shell.letsPlay')} <ArrowUpRight size={16} />
            </Link>
          </div> */}
          <span className="sidebar-credit">
            {t('shell.fanProject')} <span>✳</span>
          </span>
        </div>
      </aside>
      <div className={`workspace ${routePath === '/chat/' ? 'chat-workspace' : ''} ${routePath === '/scroll/' ? 'scroll-workspace' : ''}`}>
        <header className={`topbar ${topbarHidden ? 'topbar-hidden' : ''} ${topbarScrolled ? 'topbar-scrolled' : ''}`}>
          <span className="topbar-note">
            <span className="status-dot" /> {t('shell.chaos')}
          </span>
          <div className="mobile-brand-group">
            <Link href="/" onClick={openPwaHomepage} className="mobile-brand">
              ambatu<span>app</span> ✳
            </Link>
            <span className="mobile-beta-badge">{t('shell.beta')}</span>
          </div>
          <div>
            <ThemeToggle />
            <div className="language-picker">
              <AppSelect value={locale} onChange={(value) => setLocale(value as typeof locale)}
                ariaLabel={t('language.label')} options={locales.map((item) => ({ value: item, label: localeNames[item], icon: languageFlag(item) }))} />
            </div>
            {/* <Link href="/favorites/" className="icon-button" aria-label={t('nav.favorites')}>
              <Heart size={19} />
            </Link> */}
            <Link href="/profile/" className={`profile-button ${routePath.startsWith('/profile/') ? 'active' : ''}`} aria-label={t('nav.profile')}>
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
        <AdBanner disabled={adDisabled || routePath.startsWith('/watch/') || routePath.startsWith('/scroll/')} />
        <footer className="footer">
          <span>
            ambatuapp <span className="orange-text">✳</span> {t('shell.stayUnserious')}
          </span>
          <nav className="footer-legal" aria-label={t('legal.footerNavigation')}>
            <Link href="/privacy/" target="_blank" rel="noopener noreferrer" onClick={openPrivacyPolicy}>{t('legal.privacyLink')}</Link>
            <Link href="/terms/" target="_blank" rel="noopener noreferrer" onClick={openTerms}>{t('legal.termsLink')}</Link>
          </nav>
          <span>{t('shell.community')}</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label={t('shell.mobileNavigation')}>
        {mobileNav.map(({ href, key, Icon }) => (
          <Link
            href={href}
            onClick={href === '/' ? openPwaHomepage : undefined}
            key={href}
            className={`${href === '/scroll/' ? 'chat-featured' : ''} ${routePath === href || (href !== '/' && routePath.startsWith(href)) ? 'active' : ''}`}
          >
            <Icon size={21} />
            <span>{t(key)}</span>
            {href === '/explore/' && incomingCount > 0 && <span className="mobile-friend-count" aria-label={t('friends.requestCount', { count: incomingCount })}>{incomingCount > 99 ? '99+' : incomingCount}</span>}
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
