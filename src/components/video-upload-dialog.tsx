'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Upload, Video, X } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { navigateLegalLinkInApp } from '@/lib/legal-navigation';

export type PublishedVideo = {
  id: string;
  title: string;
  description: string;
  uploader: string;
  uploaderId: string | null;
  uploaderAvatarUrl: string | null;
  videoUrl: string;
  thumbnailUrl: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  userVote: 0;
  createdAt: string;
};

const api = () => `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/videos`;

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

export function VideoUploadDialog({ onClose, onPublished }: { onClose: () => void; onPublished: (video: PublishedVideo) => void }) {
  const { t } = useI18n();
  const { user, getIdToken } = useAuth();
  const router = useRouter();
  const [agreementBefore, agreementAfter] = t('watch.uploadAgreement').split('{terms}');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  const uploadingRef = useRef(uploading);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { uploadingRef.current = uploading; }, [uploading]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !uploadingRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const focusable = [...document.querySelectorAll<HTMLElement>('.video-upload-dialog button:not(:disabled), .video-upload-dialog input:not(:disabled), .video-upload-dialog textarea:not(:disabled), .video-upload-dialog a[href]')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !user) return;
    if (file.size > 200 * 1024 * 1024) { setUploadError(t('watch.fileTooLarge')); return; }
    setUploading(true); setUploadError('');
    try {
      const [token, thumbnail] = await Promise.all([getIdToken(), thumbnailFromVideo(file)]);
      if (!token) throw new Error('Authentication required.');
      const presign = await fetch(`${api()}/presign`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }) });
      const signed = await presign.json();
      if (!presign.ok) throw new Error(signed.error);
      let uploads: Response[];
      try {
        uploads = await Promise.all([
          fetch(signed.sourceUploadUrl, { method: 'PUT', headers: signed.sourceUploadHeaders, body: file }),
          fetch(signed.thumbnailUploadUrl, { method: 'PUT', headers: signed.thumbnailUploadHeaders, body: thumbnail }),
        ]);
      } catch { throw new Error(t('watch.uploadCorsError')); }
      if (uploads.some(response => !response.ok)) throw new Error(`${t('watch.uploadFailed')} (S3 ${uploads.find(response => !response.ok)?.status})`);
      await waitForCompression(token, signed.sourceKey, signed.videoKey);
      const response = await fetch(api(), { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ title, description, videoKey: signed.videoKey, thumbnailKey: signed.thumbnailKey }) });
      const created = await response.json();
      if (!response.ok) throw new Error(created.error);
      onPublished(created as PublishedVideo);
      onClose();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      setUploadError(message === 'thumbnail' ? t('watch.thumbnailFailed') : message === t('watch.uploadCorsError') ? t('watch.uploadCorsError') : t('watch.uploadFailed'));
    } finally { setUploading(false); }
  }

  return createPortal(<div className="video-upload-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !uploading) onClose(); }}>
    <form className="watch-upload video-upload-dialog" onSubmit={publish} role="dialog" aria-modal="true" aria-labelledby="video-upload-dialog-title">
      <header className="video-upload-dialog-header">
        <div><h2 id="video-upload-dialog-title">{t('watch.uploadTitle')}</h2></div>
        <button ref={closeButton} type="button" className="video-upload-close" aria-label={t('watch.closeVideo')} onClick={onClose} disabled={uploading}><X size={19}/></button>
      </header>
      <div className="video-upload-dialog-fields">
        <label>{t('watch.videoTitle')}<input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} required disabled={uploading} /></label>
        <label>{t('watch.descriptionLabel')}<textarea value={description} maxLength={1000} onChange={event => setDescription(event.target.value)} disabled={uploading} /></label>
        <label className="watch-file"><Video size={22}/><span>{file?.name ?? t('watch.chooseVideo')}</span><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => setFile(event.target.files?.[0] ?? null)} required disabled={uploading}/></label>
        <label className="watch-upload-agreement">
          <input type="checkbox" required disabled={uploading}/>
          <span>{agreementBefore}<Link href="/terms/" target="_blank" rel="noopener noreferrer" onClick={event => navigateLegalLinkInApp(event, '/terms/', href => router.push(href))}>{t('terms.title')}</Link>{agreementAfter}</span>
        </label>
        {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
      </div>
      <footer className="video-upload-dialog-actions"><button className="button dark" disabled={uploading || !user}>{uploading ? t('watch.uploading') : <><Upload size={16}/>{t('watch.publish')}</>}</button></footer>
      <span className="sr-only" aria-live="polite">{uploading ? t('watch.uploading') : ''}</span>
    </form>
  </div>, document.body);
}
