'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowBigDown, ArrowBigUp, MessageCircle, Upload, Video } from 'lucide-react';
import { AdBanner } from './ad-banner';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import { SortPicker } from './sort-picker';
import { VideoUploadDialog } from './video-upload-dialog';

type CommunityVideo = { id: string; title: string; description: string; uploader: string; uploaderId?: string | null; uploaderAvatarUrl?: string | null; thumbnailUrl: string; upvotes: number; downvotes: number; commentCount: number; createdAt?: string | null };
type SortOrder = 'upvotes' | 'newest' | 'relevance';
const SORT_STORAGE_KEY = 'ambatuapp-watch-sort';
const isSortOrder = (value: string | null): value is SortOrder => value === 'upvotes' || value === 'newest' || value === 'relevance';
const api = () => `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/videos`;
const RELEVANCE_BOOST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RELEVANCE_BOOST_POINTS = 5;
const createdAt = (video: CommunityVideo) => {
  const timestamp = Date.parse(video.createdAt ?? '');
  return Number.isFinite(timestamp) ? timestamp : 0;
};
const relevanceScore = (video: CommunityVideo, now: number) => {
  const freshness = Math.max(0, Math.min(1, 1 - Math.max(0, now - createdAt(video)) / RELEVANCE_BOOST_WINDOW_MS));
  return video.upvotes + video.commentCount * .5 + freshness * RELEVANCE_BOOST_POINTS;
};
const orderVideos = (items: CommunityVideo[], sort: SortOrder) => {
  const now = Date.now();
  return [...items].sort((a, b) =>
    (sort === 'newest'
      ? createdAt(b) - createdAt(a)
      : sort === 'relevance'
        ? relevanceScore(b, now) - relevanceScore(a, now) || b.upvotes - a.upvotes || createdAt(b) - createdAt(a)
        : b.upvotes - a.upvotes || createdAt(b) - createdAt(a))
    || a.id.localeCompare(b.id),
  );
};

export function CommunityWatch() {
  const { t } = useI18n(), { user } = useAuth();
  const [videos, setVideos] = useState<CommunityVideo[]>([]), [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [cursor, setCursor] = useState<string | number | null | undefined>(undefined), [error, setError] = useState('');
  const [sort, setSort] = useState<SortOrder>('relevance'), [sortReady, setSortReady] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const listRequestId = useRef(0);

  useEffect(() => {
    try {
      const savedSort = localStorage.getItem(SORT_STORAGE_KEY);
      if (isSortOrder(savedSort)) setSort(savedSort);
    } catch {}
    setSortReady(true);
  }, []);
  useEffect(() => {
    if (!sortReady) return;
    try { localStorage.setItem(SORT_STORAGE_KEY, sort); }
    catch {}
  }, [sort, sortReady]);

  const loadPage = useCallback(async (next?: string | number) => {
    const requestId = listRequestId.current;
    const params = new URLSearchParams({ limit: '8', sort });
    if (next !== undefined) params.set('cursor', String(next));
    const response = await fetch(`${api()}?${params}`, { cache: 'no-store' });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    if (requestId !== listRequestId.current) return;
    setVideos(items => {
      if (next === undefined) return data.videos ?? [];
      const existing = new Set(items.map(item => item.id));
      return [...items, ...(data.videos ?? []).filter((item: CommunityVideo) => !existing.has(item.id))];
    }); setCursor(data.nextCursor ?? null);
  }, [sort]);
  useEffect(() => {
    if (!sortReady) return;
    const requestId = ++listRequestId.current;
    const controller = new AbortController();
    fetch(`${api()}?limit=8&sort=${sort}`, { cache: 'no-store', signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (requestId === listRequestId.current) { setVideos(data.videos ?? []); setCursor(data.nextCursor ?? null); } })
      .catch(reason => { if (!controller.signal.aborted && requestId === listRequestId.current && reason.name !== 'AbortError') setError(reason instanceof Error ? reason.message : t('watch.communityError')); })
      .finally(() => { if (!controller.signal.aborted && requestId === listRequestId.current) setLoading(false); });
    return () => controller.abort();
  }, [sort, sortReady, t]);
  useEffect(() => {
    const node = sentinel.current; if (!node || !cursor || loadingMore) return;
    const requestId = listRequestId.current;
    const observer = new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) return; setLoadingMore(true); void loadPage(cursor).finally(() => { if (requestId === listRequestId.current) setLoadingMore(false); }); }, { rootMargin: '300px' });
    observer.observe(node); return () => observer.disconnect();
  }, [cursor, loadPage, loadingMore]);

  function changeSort(value: string) {
    if (value !== 'upvotes' && value !== 'newest' && value !== 'relevance') return;
    if (value === sort) return;
    listRequestId.current += 1;
    setSort(value);
    setVideos([]);
    setCursor(undefined);
    setError('');
    setLoading(true);
    setLoadingMore(false);
  }

  return <section className="community-watch" aria-labelledby="community-watch-title">
    <div className="community-watch-heading">
      <div className="community-watch-intro">
        <p className="eyebrow"><span className="watch-accent-dot" />{t('watch.communityEyebrow')}</p>
        <h2 id="community-watch-title">{t('watch.communityTitle')}</h2>
        <p>{t('watch.communityDescription')}</p>
      </div>
      {user ? <button className="button dark compact" onClick={() => setUploadOpen(true)}><Upload size={16}/>{t('watch.upload')}</button> : <span className="watch-signin-note">{t('watch.signInUpload')}</span>}
    </div>
    <div className="community-watch-toolbar"><SortPicker value={sort} onChange={changeSort} disabled={!videos.length} options={[{ value: 'upvotes', label: t('common.sortPopularity') }, { value: 'newest', label: t('common.sortNewest') }, { value: 'relevance', label: t('common.sortRelevance') }]} /></div>
    {uploadOpen && <VideoUploadDialog onClose={() => setUploadOpen(false)} onPublished={created => { setError(''); setVideos(items => orderVideos([created, ...items], sort)); }}/>}
    <AdBanner />

    {loading ? <div className="module-loading"><LoadingIndicator label={t('watch.loading')} /></div> : error ? <p className="feed-notice" role="alert">{error}</p> : videos.length ? <div className="community-video-grid">{videos.map(video => <article className="community-video-card" key={video.id}>
      <Link className="community-video-thumb" href={`/watch/${video.id}/`} aria-label={video.title}>{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy"/> : <Video size={38}/>}</Link>
      <div className="community-video-copy"><h3><Link href={`/watch/${video.id}/`}>{video.title}</Link></h3><span className="community-video-author">{video.uploaderAvatarUrl && <img className="profile-avatar-inline" src={video.uploaderAvatarUrl} alt=""/>}{video.uploaderId && video.uploaderId !== user?.id ? <Link href={`/chat/?user=${encodeURIComponent(video.uploaderId)}&name=${encodeURIComponent(video.uploader)}`} aria-label={t('chat.messageUser', { name: video.uploader })}>{t('watch.uploadedBy', { email: video.uploader })}</Link> : t('watch.uploadedBy', { email: video.uploader })}</span>{video.description && <p>{video.description}</p>}<div className="community-video-stats"><span aria-label={`${t('lore.upvote')}: ${video.upvotes}`}><ArrowBigUp size={17}/>{video.upvotes}</span><span aria-label={`${t('lore.downvote')}: ${video.downvotes}`}><ArrowBigDown size={17}/>{video.downvotes}</span><span aria-label={`${t('lore.comments')}: ${video.commentCount}`}><MessageCircle size={16}/>{video.commentCount}</span></div></div>
    </article>)}</div> : <div className="empty-state"><Video/><h3>{t('watch.noCommunityVideos')}</h3><p>{t('watch.noCommunityVideosHint')}</p></div>}
    <div className="community-scroll-sentinel" ref={sentinel}>{loadingMore && <LoadingIndicator label={t('watch.loadingMore')} compact />}</div>
  </section>;
}
