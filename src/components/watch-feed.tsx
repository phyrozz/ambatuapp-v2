'use client';
import { useEffect, useState } from 'react';
import { Search, ArrowUpRight, RefreshCw } from 'lucide-react';
import { getCharacters, type Character } from '@/lib/characters';
import { fetchJson, parseVideos, type Video } from '@/lib/feeds';
import { openExternal } from '@/lib/native';
import { EmptyState } from './cards';
import { useI18n } from './i18n-provider';
import { CommunityWatch } from './community-watch';
import { LoadingIndicator } from './loading-indicator';
const endpoint = process.env.NEXT_PUBLIC_VIDEO_FEED_URL;
export function WatchFeed() {
  const { t } = useI18n();
  const [q, setQ] = useState(''),
    [videos, setVideos] = useState<Video[]>([]),
    [status, setStatus] = useState(endpoint ? 'loading' : 'unconfigured'),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(true);
  useEffect(() => { void getCharacters().then(setCharacters).catch(() => {}).finally(() => setCharactersLoading(false)); }, []);
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
          setError(e instanceof Error ? e.message : t('watch.loadError'));
          setStatus('error');
        }
      });
    return () => controller.abort();
  }, [attempt, t]);
  const filtered = videos.filter((v) =>
    `${v.title} ${v.channel}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <CommunityWatch />
      {/* <form
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
            aria-label={t('watch.searchLabel')}
            placeholder={t('watch.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button className="button dark compact" type="submit">
          {t('watch.searchYouTube')}
          <ArrowUpRight size={16} />
        </button>
      </form> */}
      {status === 'loading' && (
        <div className="module-loading">
          <LoadingIndicator label={t('watch.loading')} />
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
            {t('watch.tryAgain')}
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
            title={t('watch.none')}
            description={t('watch.noneHint')}
          />
        ))}
    </>
  );
}
