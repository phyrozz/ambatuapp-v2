'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowBigDown, ArrowBigUp, MessageCircle, Upload, Video, X } from 'lucide-react';
import { AdBanner } from './ad-banner';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import { AppSelect } from './app-select';

type CommunityVideo = { id: string; title: string; description: string; uploader: string; uploaderId?: string; uploaderAvatarUrl?: string | null; thumbnailUrl: string; upvotes: number; downvotes: number; commentCount: number; createdAt?: string | null };
type SortOrder = 'upvotes' | 'newest';
const api = () => `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/videos`;
const createdAt = (video: CommunityVideo) => {
  const timestamp = Date.parse(video.createdAt ?? '');
  return Number.isFinite(timestamp) ? timestamp : 0;
};
const orderVideos = (items: CommunityVideo[], sort: SortOrder) => [...items].sort((a, b) =>
  (sort === 'newest' ? createdAt(b) - createdAt(a) : b.upvotes - a.upvotes || createdAt(b) - createdAt(a))
  || a.id.localeCompare(b.id),
);

function waitForVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onLoaded = () => finish();
    const onError = () => finish(new Error('thumbnail'));
    const timeout = window.setTimeout(() => finish(new Error('thumbnail')), 10000);
    video.addEventListener('loadedmetadata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.load();
  });
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onSeeked = () => finish();
    const onError = () => finish(new Error('thumbnail'));
    const timeout = window.setTimeout(() => finish(new Error('thumbnail')), 10000);
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    try { video.currentTime = time; }
    catch { finish(new Error('thumbnail')); }
  });
}

async function waitForVideoFrame(video: HTMLVideoElement) {
  const frameVideo = video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: () => void) => number };
  if (frameVideo.requestVideoFrameCallback) {
    await new Promise<void>(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        resolve();
      };
      const timeout = window.setTimeout(finish, 300);
      frameVideo.requestVideoFrameCallback?.(finish);
    });
  }
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function hasVisiblePixels(frame: ImageData) {
  const stepX = Math.max(1, Math.floor(frame.width / 8));
  const stepY = Math.max(1, Math.floor(frame.height / 6));
  let samples = 0, visible = 0;
  for (let y = Math.floor(stepY / 2); y < frame.height; y += stepY) {
    for (let x = Math.floor(stepX / 2); x < frame.width; x += stepX) {
      const offset = (y * frame.width + x) * 4;
      const brightness = (frame.data[offset] * 299 + frame.data[offset + 1] * 587 + frame.data[offset + 2] * 114) / 1000;
      samples++;
      if (brightness > 22) visible++;
    }
  }
  return visible >= Math.min(2, samples);
}

async function thumbnailFromVideo(file: File) {
  const url = URL.createObjectURL(file), video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = url;
  try {
    await waitForVideoMetadata(video);
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) throw new Error('thumbnail');
    const canvas = document.createElement('canvas'), ratio = Math.min(1, 720 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * ratio)); canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('thumbnail');
    const lastFrameTime = Math.max(0, video.duration - Math.min(.04, video.duration / 10));
    const times = [...new Set([Math.min(1, video.duration / 4), video.duration * .4, video.duration * .6, video.duration * .8].map(time => Math.min(lastFrameTime, Math.max(0, time))))];
    let selectedFrame: ImageData | null = null;
    for (const time of times) {
      await seekVideo(video, time);
      await waitForVideoFrame(video);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      if (!selectedFrame || hasVisiblePixels(frame)) selectedFrame = frame;
      if (hasVisiblePixels(frame)) break;
    }
    if (!selectedFrame) throw new Error('thumbnail');
    context.putImageData(selectedFrame, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('thumbnail')), 'image/jpeg', .82));
  } finally { URL.revokeObjectURL(url); }
}

const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForCompression(token: string, sourceKey: string, videoKey: string) {
  const start = await fetch(`${api()}/transcode`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ sourceKey, videoKey }) });
  const created = await start.json();
  if (!start.ok) throw new Error(created.error);
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    await pause(5000);
    const response = await fetch(`${api()}/transcode?jobId=${encodeURIComponent(created.jobId)}`, { cache: 'no-store', headers: { authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (result.status === 'COMPLETE' && result.videoKey === videoKey) return;
    if (result.status === 'ERROR' || result.status === 'CANCELED') throw new Error(result.error || result.status);
  }
  throw new Error('Video compression timed out.');
}

export function CommunityWatch() {
  const { t } = useI18n(), { user, getIdToken } = useAuth();
  const [videos, setVideos] = useState<CommunityVideo[]>([]), [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [cursor, setCursor] = useState<number | null | undefined>(undefined), [error, setError] = useState('');
  const [sort, setSort] = useState<SortOrder>('upvotes');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [file, setFile] = useState<File | null>(null), [uploading, setUploading] = useState(false), [uploadError, setUploadError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const listRequestId = useRef(0);

  const loadPage = useCallback(async (next?: number) => {
    const requestId = listRequestId.current;
    const params = new URLSearchParams({ limit: '8', sort });
    if (next !== undefined) params.set('cursor', String(next));
    const response = await fetch(`${api()}?${params}`, { cache: 'no-store' });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    if (requestId !== listRequestId.current) return;
    setVideos(items => next !== undefined ? [...items, ...(data.videos ?? [])] : data.videos ?? []); setCursor(data.nextCursor ?? null);
  }, [sort]);
  useEffect(() => {
    const requestId = ++listRequestId.current;
    const controller = new AbortController();
    fetch(`${api()}?limit=8&sort=${sort}`, { cache: 'no-store', signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (requestId === listRequestId.current) { setVideos(data.videos ?? []); setCursor(data.nextCursor ?? null); } })
      .catch(reason => { if (!controller.signal.aborted && requestId === listRequestId.current && reason.name !== 'AbortError') setError(reason instanceof Error ? reason.message : t('watch.communityError')); })
      .finally(() => { if (!controller.signal.aborted && requestId === listRequestId.current) setLoading(false); });
    return () => controller.abort();
  }, [sort, t]);
  useEffect(() => {
    const node = sentinel.current; if (!node || !cursor || loadingMore) return;
    const requestId = listRequestId.current;
    const observer = new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) return; setLoadingMore(true); void loadPage(cursor).finally(() => { if (requestId === listRequestId.current) setLoadingMore(false); }); }, { rootMargin: '300px' });
    observer.observe(node); return () => observer.disconnect();
  }, [cursor, loadPage, loadingMore]);

  function changeSort(value: string) {
    if (value !== 'upvotes' && value !== 'newest') return;
    if (value === sort) return;
    listRequestId.current += 1;
    setSort(value);
    setVideos([]);
    setCursor(undefined);
    setError('');
    setLoading(true);
    setLoadingMore(false);
  }

  async function publish(event: FormEvent) {
    event.preventDefault(); if (!file || !user) return; if (file.size > 200 * 1024 * 1024) return setUploadError(t('watch.fileTooLarge'));
    setUploading(true); setUploadError('');
    try {
      const [token, thumbnail] = await Promise.all([getIdToken(), thumbnailFromVideo(file)]);
      if (!token) throw new Error('Authentication required.');
      const presign = await fetch(`${api()}/presign`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }) });
      const signed = await presign.json(); if (!presign.ok) throw new Error(signed.error);
      let uploads: Response[];
      try { uploads = await Promise.all([fetch(signed.sourceUploadUrl, { method: 'PUT', headers: signed.sourceUploadHeaders, body: file }), fetch(signed.thumbnailUploadUrl, { method: 'PUT', headers: signed.thumbnailUploadHeaders, body: thumbnail })]); }
      catch { throw new Error(t('watch.uploadCorsError')); }
      if (uploads.some(response => !response.ok)) throw new Error(`${t('watch.uploadFailed')} (S3 ${uploads.find(response => !response.ok)?.status})`);
      await waitForCompression(token, signed.sourceKey, signed.videoKey);
      const response = await fetch(api(), { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ title, description, videoKey: signed.videoKey, thumbnailKey: signed.thumbnailKey }) });
      const created = await response.json(); if (!response.ok) throw new Error(created.error);
      setVideos(items => orderVideos([created, ...items], sort)); setTitle(''); setDescription(''); setFile(null); setUploadOpen(false);
    } catch (reason) { setUploadError(reason instanceof Error && reason.message === 'thumbnail' ? t('watch.thumbnailFailed') : t('watch.uploadFailed')); } finally { setUploading(false); }
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
    <div className="community-watch-toolbar"><span>{t('common.sortBy')}</span><AppSelect value={sort} onChange={changeSort} ariaLabel={t('common.sortBy')} options={[{ value: 'upvotes', label: t('common.sortPopularity') }, { value: 'newest', label: t('common.sortNewest') }]} /></div>
    {uploadOpen && <form className="watch-upload panel" onSubmit={publish}><button type="button" className="icon-button" aria-label={t('watch.closeVideo')} onClick={() => setUploadOpen(false)}><X size={17}/></button><h3>{t('watch.uploadTitle')}</h3><label>{t('watch.videoTitle')}<input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} required /></label><label>{t('watch.descriptionLabel')}<textarea value={description} maxLength={1000} onChange={event => setDescription(event.target.value)} /></label><label className="watch-file"><Video size={22}/><span>{file?.name ?? t('watch.chooseVideo')}</span><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => setFile(event.target.files?.[0] ?? null)} required disabled={uploading}/></label>{uploadError && <p className="form-error">{uploadError}</p>}<button className="button dark" disabled={uploading}>{uploading ? t('watch.uploading') : t('watch.publish')}</button></form>}
    <AdBanner />

    {loading ? <div className="module-loading"><LoadingIndicator label={t('watch.loading')} /></div> : error ? <p className="feed-notice" role="alert">{error}</p> : videos.length ? <div className="community-video-grid">{videos.map(video => <article className="community-video-card" key={video.id}>
      <Link className="community-video-thumb" href={`/watch/${video.id}/`} aria-label={video.title}>{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy"/> : <Video size={38}/>}</Link>
      <div className="community-video-copy"><h3><Link href={`/watch/${video.id}/`}>{video.title}</Link></h3><span className="community-video-author">{video.uploaderAvatarUrl && <img className="profile-avatar-inline" src={video.uploaderAvatarUrl} alt=""/>}{video.uploaderId && video.uploaderId !== user?.id ? <Link href={`/chat/?user=${encodeURIComponent(video.uploaderId)}&name=${encodeURIComponent(video.uploader)}`} aria-label={t('chat.messageUser', { name: video.uploader })}>{t('watch.uploadedBy', { email: video.uploader })}</Link> : t('watch.uploadedBy', { email: video.uploader })}</span>{video.description && <p>{video.description}</p>}<div className="community-video-stats"><span aria-label={`${t('lore.upvote')}: ${video.upvotes}`}><ArrowBigUp size={17}/>{video.upvotes}</span><span aria-label={`${t('lore.downvote')}: ${video.downvotes}`}><ArrowBigDown size={17}/>{video.downvotes}</span><span aria-label={`${t('lore.comments')}: ${video.commentCount}`}><MessageCircle size={16}/>{video.commentCount}</span></div></div>
    </article>)}</div> : <div className="empty-state"><Video/><h3>{t('watch.noCommunityVideos')}</h3><p>{t('watch.noCommunityVideosHint')}</p></div>}
    <div className="community-scroll-sentinel" ref={sentinel}>{loadingMore && <LoadingIndicator label={t('watch.loadingMore')} compact />}</div>
  </section>;
}
