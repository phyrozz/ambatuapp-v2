'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, AudioLines, Gamepad2, Sparkles, Play } from 'lucide-react';
import { games, sounds } from '@/lib/catalog';
import { getCharacters, type Character } from '@/lib/characters';
import { GameCard, SoundCard, CharacterCard } from '@/components/cards';
import { SectionHeading } from '@/components/shell';
export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  useEffect(() => { void getCharacters().then(setCharacters).catch(() => {}); }, []);
  return (
    <div className="page home-page">
      <div className="welcome">
        <p className="eyebrow">
          <span className="tiny-star">✳</span> WELCOME TO YOUR HAPPY PLACE
        </p>
        <span className="edition">THE AMBATUVERSE · VOL. 01</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">
            <span />
            100% GOOD VIBES. 0% SERIOUS.
          </span>
          <h1>
            <span className="hero-line">Life’s too short.</span>
            <span className="hero-line">Get a little</span>
            <span className="hero-line hero-punch">
              ambatu.<span className="hero-asterisk">✳</span>
            </span>
          </h1>
          <p>
            Your favorite faces. Iconic sounds. Games you’ll
            <br className="desktop-only" /> play “just one more time.” Welcome to the club.
          </p>
          <div className="hero-actions">
            <Link href="/games/" className="button dark">
              <Gamepad2 size={20} />
              Let’s play
              <ArrowUpRight size={19} />
            </Link>
            <Link href="/soundboard/" className="hero-secondary">
              Hit the soundboard
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="hero-foot">
            <span className="mini-avatars">
              {characters.slice(0, 3).map((c) => (
                <img key={c.id} src={c.image} alt="" />
              ))}
            </span>
            <span>Same legends. A whole new playground.</span>
          </div>
        </div>
        <div className="hero-visual">
          <span className="orbit-text">CERTIFIED INTERNET CLASSIC</span>
          <div className="hero-photo">
            <img src="/assets/dreamy_smiling.jpg" alt="Dreamybull smiling" />
            <div>
              <span>THE ORIGINAL.</span>
              <b>
                Dreamybull <span>↗</span>
              </b>
            </div>
          </div>
          <span className="hero-sticker sticker-top">
            <Sparkles size={18} /> main character energy
          </span>
          <span className="hero-sticker sticker-bottom">
            <AudioLines size={22} /> you already know.
          </span>
          <span className="doodle">✦</span>
          <span className="hero-caption">EST. IN THE GROUP CHAT ↗</span>
        </div>
      </section>
      <div className="ticker">
        <span>THE GANG’S ALL HERE</span>
        <span>✳</span>
        <span>PLAY. LAUGH. REPEAT.</span>
        <span>✳</span>
        <span>A LITTLE INTERNET HISTORY</span>
        <span>✳</span>
        <span>BIG MAIN CHARACTER ENERGY</span>
        <span>✳</span>
      </div>
      <section className="section">
        <SectionHeading
          eyebrow="PRESS PLAY, FORGET THE REST"
          title="Small games. Big energy."
          href="/games/"
          link="All games"
        />
        <div className="game-grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>
      <section className="section sound-section">
        <SectionHeading
          eyebrow="SOUNDS YOU CAN HEAR JUST BY READING"
          title="The sound of the internet."
          href="/soundboard/"
          link="Open soundboard"
        />
        <div className="sound-grid">
          {[sounds[0], sounds[2], sounds[15], sounds[25]].map((sound, i) => (
            <SoundCard key={sound.id} sound={sound} index={i} />
          ))}
        </div>
        <p className="section-footnote">
          <AudioLines size={14} /> Tap to play. Layer the chaos. Headphones recommended.
        </p>
      </section>
      <section className="section">
        <SectionHeading
          eyebrow="KNOW YOUR LEGENDS"
          title="Meet the Ambatuverse."
          href="/characters/"
          link="The whole crew"
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
          <p className="eyebrow">DOWN THE RABBIT HOLE</p>
          <h2>There’s always one more clip.</h2>
          <p>Your next internet detour starts at AmbatuWatch.</p>
        </div>
        <span className="button dark">
          Explore videos
          <ArrowUpRight size={19} />
        </span>
      </Link>
    </div>
  );
}
