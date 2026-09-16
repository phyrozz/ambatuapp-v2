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
} from 'lucide-react';
import { useApp } from './app-provider';
const nav = [
  { href: '/', label: 'Discover', Icon: House },
  { href: '/games/', label: 'Mini-games', Icon: Gamepad2 },
  { href: '/soundboard/', label: 'Soundboard', Icon: AudioLines },
  { href: '/characters/', label: 'Characters', Icon: UsersRound },
  { href: '/lores/', label: 'Lore', Icon: BookOpen },
  { href: '/watch/', label: 'AmbatuWatch', Icon: Play },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [topbarHidden, setTopbarHidden] = useState(false);
  const [topbarScrolled, setTopbarScrolled] = useState(false);
  const { current, playing, stop, volume, setVolume, error } = useApp();
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
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            a<span>✳</span>
          </span>
          <span>
            ambatu<span className="orange-text">app</span>
            <small>THE INTERNET’S HAPPY PLACE</small>
          </span>
        </Link>
        <p className="nav-label">YOUR DAILY DOSE</p>
        <nav aria-label="Main navigation">
          {nav.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{label}</span>
              {href === '/games/' && <small>4</small>}
            </Link>
          ))}
        </nav>
        <div className="nav-divider" />
        <Link className={`nav-item ${path === '/favorites/' ? 'active' : ''}`} href="/favorites/">
          <Heart size={20} />
          Your favorites
        </Link>
        <Link className={`nav-item ${path === '/profile/' ? 'active' : ''}`} href="/profile/">
          <UserRound size={20} />
          MyDreamy
        </Link>
        <div className="sidebar-bottom">
          <div className="good-vibes">
            <Sparkles size={21} />
            <b>Made for the plot.</b>
            <p>
              A little weird. A lot of fun.
              <br />
              Always a good time.
            </p>
            <Link href="/games/">
              Let’s play <ArrowUpRight size={16} />
            </Link>
          </div>
          <span className="sidebar-credit">
            An unofficial fan project <span>✳</span>
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className={`topbar ${topbarHidden ? 'topbar-hidden' : ''} ${topbarScrolled ? 'topbar-scrolled' : ''}`}>
          <span className="topbar-note">
            <span className="status-dot" /> A little chaos. A lot of fun.
          </span>
          <Link href="/" className="mobile-brand">
            ambatu<span>app</span> ✳
          </Link>
          <div>
            <Link href="/favorites/" className="icon-button" aria-label="Your favorites">
              <Heart size={19} />
            </Link>
            <Link href="/profile/" className="profile-button">
              <img src="/assets/dreamy_face.jpg" alt="" />
              <span>Your corner</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="footer">
          <span>
            ambatuapp <span className="orange-text">✳</span> Stay a little unserious.
          </span>
          <span>Built for the community. Just for fun.</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map(({ href, label, Icon }) => (
          <Link
            href={href}
            key={href}
            className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}
          >
            <Icon size={21} />
            <span>
              {label === 'Mini-games' ? 'Games' : label === 'AmbatuWatch' ? 'Watch' : label}
            </span>
          </Link>
        ))}
      </nav>
      {current && (
        <div className="audio-dock">
          <span className="now-playing">
            <AudioLines size={23} />
            <span>
              <small>NOW PLAYING {playing.length > 1 && `· ${playing.length} SOUNDS`}</small>
              <b>{current.name}</b>
            </span>
          </span>
          <label className="volume">
            <Volume2 size={19} />
            <input
              aria-label="Volume"
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
            Stop all
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
  link = 'Explore all',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link href={href} className="text-link">
          {link}
          <ArrowRight size={17} />
        </Link>
      )}
    </div>
  );
}
