'use client';
import { useEffect, useState } from 'react';
import { Search, ArrowUpRight, RefreshCw } from 'lucide-react';
import { getCharacters, type Character } from '@/lib/characters';
import { fetchJson, parseVideos, type Video } from '@/lib/feeds';
import { openExternal } from '@/lib/native';
import { EmptyState } from './cards';
const endpoint = process.env.NEXT_PUBLIC_VIDEO_FEED_URL;
export function WatchFeed() {
  const [q, setQ] = useState(''),
    [videos, setVideos] = useState<Video[]>([]),
    [status, setStatus] = useState(endpoint ? 'loading' : 'unconfigured'),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [characters, setCharacters] = useState<Character[]>([]);
  useEffect(() => { void getCharacters().then(setCharacters).catch(() => {}); }, []);
  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    fetchJson(endpoint, controller.signal)
      .then(parseVideos)
      .then((v) => {
        setVideos(v);
        setStatus('ready');
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Could not load videos.');
          setStatus('error');
        }
      });
    return () => controller.abort();
  }, [attempt]);
  const filtered = videos.filter((v) =>
    `${v.title} ${v.channel}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <form
        className="watch-search"
        onSubmit={(e) => {
          e.preventDefault();
          void openExternal(
            `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim() || 'AmbatuApp memes')}`,
          );
        }}
      >
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Search videos"
            placeholder="Find a clip, a remix, a rabbit hole…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button className="button dark compact" type="submit">
          Search YouTube
          <ArrowUpRight size={16} />
        </button>
      </form>
      {status === 'loading' && (
        <div className="loading-panel" role="status">
          Finding your next detour…
        </div>
      )}
      {status === 'error' && (
        <div className="feed-notice" role="alert">
          <p>{error}</p>
          <button
            className="button secondary compact"
            onClick={() => {
              setStatus('loading');
              setAttempt((a) => a + 1);
            }}
          >
            <RefreshCw size={15} />
            Try again
          </button>
        </div>
      )}
      {status === 'ready' &&
        (filtered.length ? (
          <div className="video-grid">
            {filtered.map((v, i) => (
              <button
                className="video-card"
                key={`${v.url}-${i}`}
                onClick={() => void openExternal(v.url)}
              >
                {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" />}
                <h3>{v.title}</h3>
                <p>{v.channel} ↗</p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No clips found."
            description="Try another search, or head to YouTube with the search button above."
          />
        ))}
      {status !== 'ready' && (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">PICK YOUR NEXT DETOUR</p>
              <h2>Explore the originals.</h2>
            </div>
          </div>
          <div className="video-grid">
            {characters
              .filter((c) =>
                ['dreamy', 'yes_king', 'kakangku', 'nissan', 'bunda', 'bus_soldier'].includes(c.id),
              )
              .map((c) => (
                <button
                  className="video-card"
                  key={c.id}
                  onClick={() =>
                    void openExternal(
                      `https://www.youtube.com/results?search_query=${encodeURIComponent(c.name + ' memes')}`,
                    )
                  }
                >
                  {c.header && <img src={c.header} alt="" />}
                  <h3>
                    {c.name}
                    <span className="orange-text"> ↗</span>
                  </h3>
                  <p>Explore clips & remixes on YouTube</p>
                </button>
              ))}
          </div>
          {status === 'unconfigured' && (
            <p className="feed-notice">
              Explore videos directly on YouTube. A live community feed hasn’t been connected yet.
            </p>
          )}
        </>
      )}
    </>
  );
}
