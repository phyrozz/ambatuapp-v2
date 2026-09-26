'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowBigDown, ArrowBigUp, ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { AdBanner } from './ad-banner';
import { LoadingIndicator } from './loading-indicator';
import { MediaPlayer } from './media-player';

type VideoData = { id: string; title: string; description: string; uploader: string; uploaderId?: string; uploaderAvatarUrl?: string | null; videoUrl: string; upvotes: number; downvotes: number; commentCount: number };
type Comment = { id: string; text: string; author: string; authorId?: string; avatarUrl?: string | null };
const base = () => `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/videos`;
function viewerId() { const key = 'ambatu-anonymous-id'; let id = localStorage.getItem(key); if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); } return id; }

export function CommunityVideoPage({ id }: { id: string }) {
  const { t } = useI18n(), { user, getIdToken } = useAuth();
  const [video, setVideo] = useState<VideoData | null>(null), [comments, setComments] = useState<Comment[]>([]), [text, setText] = useState(''), [error, setError] = useState(''), [commentsError, setCommentsError] = useState(''), [commentsLoading, setCommentsLoading] = useState(true), [videoReady, setVideoReady] = useState(false), [userVote, setUserVote] = useState(0), [votePulse, setVotePulse] = useState<'up' | 'down' | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const controller = new AbortController(), key = `ambatu-video-vote:${id}`;
    setVideo(null); setComments([]); setError(''); setCommentsError(''); setCommentsLoading(true); setVideoReady(false);
    fetch(`${base()}/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
      .then(response => response.json().then(data => { if (!response.ok) throw new Error(data.error); return data as VideoData; }))
      .then(item => { setVideo(item); setUserVote(Number(localStorage.getItem(key)) || 0); })
      .catch(reason => { if (reason.name !== 'AbortError') setError(reason instanceof Error ? reason.message : t('watch.communityError')); });
    fetch(`${base()}/${encodeURIComponent(id)}/comments`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || t('watch.communityError')); return data; })
      .then(thread => setComments(thread.comments ?? []))
      .catch(reason => { if (reason.name !== 'AbortError') setCommentsError(reason instanceof Error ? reason.message : t('watch.communityError')); })
      .finally(() => { if (!controller.signal.aborted) setCommentsLoading(false); });
    return () => controller.abort();
  }, [id, t]);
  /* eslint-enable react-hooks/set-state-in-effect */
  async function vote(value: 1 | -1) { if (!video) return; const direction = value === 1 ? 'up' : 'down'; setVotePulse(null); requestAnimationFrame(() => setVotePulse(direction)); setTimeout(() => setVotePulse(null), 520); const key = `ambatu-video-vote:${id}`, prior = userVote, response = await fetch(`${base()}/${id}/vote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ anonymousId: viewerId(), value }) }), data = await response.json(); if (!response.ok) return; localStorage.setItem(key, String(data.value)); setUserVote(data.value); setVideo({ ...video, upvotes: video.upvotes + (data.value === 1 ? 1 : 0) - (prior === 1 ? 1 : 0), downvotes: video.downvotes + (data.value === -1 ? 1 : 0) - (prior === -1 ? 1 : 0) }); }
  async function comment(event: FormEvent) { event.preventDefault(); if (!video || !text.trim()) return; const token = await getIdToken(), response = await fetch(`${base()}/${id}/comments`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ anonymousId: viewerId(), text }) }), data = await response.json(); if (!response.ok) return; setComments(items => [data, ...items]); setVideo({ ...video, commentCount: video.commentCount + 1 }); setText(''); }
  return <div className="page community-video-page">
    <Link className="back-link watch-back-link" href="/watch/"><ArrowLeft size={17}/>{t('watch.back')}</Link>
    <AdBanner />
    {error ? <div className="feed-notice" role="alert">{error}</div> : !video ? <div className="module-loading"><LoadingIndicator label={t('watch.openingVideo')} /></div> : <article className="community-video-reader">
      <div className="community-video-stage">{!videoReady && <div className="video-media-loading"><LoadingIndicator label={t('watch.openingVideo')} /></div>}<MediaPlayer src={video.videoUrl} autoPlay variant="watch" onLoadedData={() => setVideoReady(true)} onError={() => setVideoReady(true)} /></div>
      <div className="community-video-reader-copy">
        <div className="community-video-story">
          <p className="eyebrow"><span className="watch-accent-dot" />{t('watch.communityEyebrow')}</p>
          <h1>{video.title}</h1>
          <span className="community-video-byline">{video.uploaderAvatarUrl && <img className="profile-avatar-inline" src={video.uploaderAvatarUrl} alt=""/>}{video.uploaderId && video.uploaderId !== user?.id ? <Link href={`/chat/?user=${encodeURIComponent(video.uploaderId)}&name=${encodeURIComponent(video.uploader)}`} aria-label={t('chat.messageUser', { name: video.uploader })}>{t('watch.uploadedBy', { email: video.uploader })}</Link> : t('watch.uploadedBy', { email: video.uploader })}</span>
          {video.description && <p className="community-video-description">{video.description}</p>}
          <div className="community-video-actions" aria-label={t('watch.communityEyebrow')}>
            <button className={`up ${userVote === 1 ? 'selected' : ''} ${votePulse === 'up' ? 'vote-pop' : ''}`} aria-label={`${t('lore.upvote')}: ${video.upvotes}`} aria-pressed={userVote === 1} onClick={() => void vote(1)}><ArrowBigUp size={20}/><span>{video.upvotes}</span></button>
            <button className={`down ${userVote === -1 ? 'selected' : ''} ${votePulse === 'down' ? 'vote-pop' : ''}`} aria-label={`${t('lore.downvote')}: ${video.downvotes}`} aria-pressed={userVote === -1} onClick={() => void vote(-1)}><ArrowBigDown size={20}/><span>{video.downvotes}</span></button>
            <span className="community-comment-count"><MessageCircle size={19}/>{video.commentCount}</span>
          </div>
        </div>
        <section className="video-comments" aria-labelledby="video-comments-title">
          <div className="video-comments-heading"><MessageCircle size={18}/><h2 id="video-comments-title">{t('lore.comments')}</h2><span>{video.commentCount}</span></div>
          <form onSubmit={comment}><input aria-label={t('watch.commentPlaceholder')} value={text} maxLength={1000} onChange={event => setText(event.target.value)} placeholder={t('watch.commentPlaceholder')}/><button aria-label={t('watch.postComment')} disabled={!text.trim()}><Send size={16}/></button></form>
          <div className="video-comment-list">{commentsLoading ? <div className="comments-loading"><LoadingIndicator label={t('common.loading')} compact /></div> : commentsError ? <p role="alert">{commentsError}</p> : comments.map(item => <p key={item.id}>{item.avatarUrl && <img className="profile-avatar-inline" src={item.avatarUrl} alt=""/>}<b>{item.authorId && item.authorId !== user?.id ? <Link href={`/chat/?user=${encodeURIComponent(item.authorId)}&name=${encodeURIComponent(item.author)}`} aria-label={t('chat.messageUser', { name: item.author })}>{item.author}</Link> : item.author}</b><span>{item.text}</span></p>)}</div>
        </section>
      </div>
    </article>}
  </div>;
}
