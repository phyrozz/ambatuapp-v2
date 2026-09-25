'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowBigDown, ArrowBigUp, MessageCircle, Upload, Video, X } from 'lucide-react';
import { AdBanner } from './ad-banner';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';

type CommunityVideo = { id: string; title: string; description: string; uploader: string; uploaderId?: string; uploaderAvatarUrl?: string | null; thumbnailUrl: string; upvotes: number; downvotes: number; commentCount: number };
const api = () => `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/videos`;

async function thumbnailFromVideo(file: File) {
  const url = URL.createObjectURL(file), video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'metadata'; video.src = url;
  try {
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => { video.currentTime = Math.min(1, Math.max(0, video.duration / 4)); }; video.onseeked = () => resolve(); video.onerror = () => reject(new Error('thumbnail')); });
    const canvas = document.createElement('canvas'), ratio = Math.min(1, 720 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * ratio)); canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('thumbnail')), 'image/jpeg', .82));
  } finally { URL.revokeObjectURL(url); }
}

export function CommunityWatch() {
  const { t } = useI18n(), { user, getIdToken } = useAuth();
  const [videos, setVideos] = useState<CommunityVideo[]>([]), [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [cursor, setCursor] = useState<number | null | undefined>(undefined), [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [file, setFile] = useState<File | null>(null), [uploading, setUploading] = useState(false), [uploadError, setUploadError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (next?: number) => {
    const response = await fetch(`${api()}?limit=8${next ? `&cursor=${next}` : ''}`, { cache: 'no-store' });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    setVideos(items => next ? [...items, ...(data.videos ?? [])] : data.videos ?? []); setCursor(data.nextCursor ?? null);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${api()}?limit=8`, { cache: 'no-store', signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { setVideos(data.videos ?? []); setCursor(data.nextCursor ?? null); })
      .catch(reason => { if (reason.name !== 'AbortError') setError(reason instanceof Error ? reason.message : t('watch.communityError')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [t]);
  useEffect(() => {
    const node = sentinel.current; if (!node || !cursor || loadingMore) return;
    const observer = new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) return; setLoadingMore(true); void loadPage(cursor).finally(() => setLoadingMore(false)); }, { rootMargin: '300px' });
    observer.observe(node); return () => observer.disconnect();
  }, [cursor, loadPage, loadingMore]);

  async function publish(event: FormEvent) {
    event.preventDefault(); if (!file || !user) return; if (file.size > 200 * 1024 * 1024) return setUploadError(t('watch.fileTooLarge'));
    setUploading(true); setUploadError('');
    try {
      const [token, thumbnail] = await Promise.all([getIdToken(), thumbnailFromVideo(file)]);
      const presign = await fetch(`${api()}/presign`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ fileName: file.name, contentType: file.type }) });
      const signed = await presign.json(); if (!presign.ok) throw new Error(signed.error);
      let uploads: Response[];
      try { uploads = await Promise.all([fetch(signed.uploadUrl, { method: 'PUT', headers: signed.uploadHeaders, body: file }), fetch(signed.thumbnailUploadUrl, { method: 'PUT', headers: signed.thumbnailUploadHeaders, body: thumbnail })]); }
      catch { throw new Error(t('watch.uploadCorsError')); }
      if (uploads.some(response => !response.ok)) throw new Error(`${t('watch.uploadFailed')} (S3 ${uploads.find(response => !response.ok)?.status})`);
      const response = await fetch(api(), { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ title, description, videoKey: signed.key, thumbnailKey: signed.thumbnailKey }) });
      const created = await response.json(); if (!response.ok) throw new Error(created.error);
      setVideos(items => [created, ...items]); setTitle(''); setDescription(''); setFile(null); setUploadOpen(false);
    } catch (reason) { setUploadError(reason instanceof Error && reason.message !== 'thumbnail' ? reason.message : t('watch.thumbnailFailed')); } finally { setUploading(false); }
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
    <AdBanner />
    {uploadOpen && <form className="watch-upload panel" onSubmit={publish}><button type="button" className="icon-button" aria-label={t('watch.closeVideo')} onClick={() => setUploadOpen(false)}><X size={17}/></button><h3>{t('watch.uploadTitle')}</h3><label>{t('watch.videoTitle')}<input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} required /></label><label>{t('watch.descriptionLabel')}<textarea value={description} maxLength={1000} onChange={event => setDescription(event.target.value)} /></label><label className="watch-file"><Video size={22}/><span>{file?.name ?? t('watch.chooseVideo')}</span><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => setFile(event.target.files?.[0] ?? null)} required /></label>{uploadError && <p className="form-error">{uploadError}</p>}<button className="button dark" disabled={uploading}>{uploading ? t('watch.uploading') : t('watch.publish')}</button></form>}
    {loading ? <div className="module-loading"><LoadingIndicator label={t('watch.loading')} /></div> : error ? <p className="feed-notice" role="alert">{error}</p> : videos.length ? <div className="community-video-grid">{videos.map(video => <article className="community-video-card" key={video.id}>
      <Link className="community-video-thumb" href={`/watch/${video.id}/`} aria-label={video.title}>{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy"/> : <Video size={38}/>}</Link>
      <div className="community-video-copy"><h3><Link href={`/watch/${video.id}/`}>{video.title}</Link></h3><span className="community-video-author">{video.uploaderAvatarUrl && <img className="profile-avatar-inline" src={video.uploaderAvatarUrl} alt=""/>}{video.uploaderId && video.uploaderId !== user?.id ? <Link href={`/chat/?user=${encodeURIComponent(video.uploaderId)}&name=${encodeURIComponent(video.uploader)}`} aria-label={t('chat.messageUser', { name: video.uploader })}>{t('watch.uploadedBy', { email: video.uploader })}</Link> : t('watch.uploadedBy', { email: video.uploader })}</span>{video.description && <p>{video.description}</p>}<div className="community-video-stats"><span aria-label={`${t('lore.upvote')}: ${video.upvotes}`}><ArrowBigUp size={17}/>{video.upvotes}</span><span aria-label={`${t('lore.downvote')}: ${video.downvotes}`}><ArrowBigDown size={17}/>{video.downvotes}</span><span aria-label={`${t('lore.comments')}: ${video.commentCount}`}><MessageCircle size={16}/>{video.commentCount}</span></div></div>
    </article>)}</div> : <div className="empty-state"><Video/><h3>{t('watch.noCommunityVideos')}</h3><p>{t('watch.noCommunityVideosHint')}</p></div>}
    <div className="community-scroll-sentinel" ref={sentinel}>{loadingMore && <LoadingIndicator label={t('watch.loadingMore')} compact />}</div>
  </section>;
}
