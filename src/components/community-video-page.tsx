'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowBigDown, ArrowBigUp, ArrowLeft, ChevronDown, ChevronUp, MessageCircle, Send } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { AdBanner } from './ad-banner';
import { LoadingIndicator } from './loading-indicator';
import { MediaPlayer } from './media-player';
import { CommentThreadList, type ThreadComment } from './comment-thread-list';

type VideoData = { id: string; title: string; description: string; uploader: string; uploaderId?: string; uploaderAvatarUrl?: string | null; videoUrl: string; upvotes: number; downvotes: number; commentCount: number };
type Comment = ThreadComment;
const base = () => `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/videos`;
function viewerId() {
  const key = 'ambatu-anonymous-id';
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

export function CommunityVideoPage({ id }: { id: string }) {
  const { t } = useI18n();
  const { user, getIdToken } = useAuth();
  const [video, setVideo] = useState<VideoData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState('');
  const [commentsError, setCommentsError] = useState('');
  const [commentsActionError, setCommentsActionError] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [userVote, setUserVote] = useState(0);
  const [votePulse, setVotePulse] = useState<'up' | 'down' | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const descriptionIsCollapsible = Boolean(video && (video.description.length > 240 || video.description.split(/\r?\n/).length > 5));

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    window.scrollTo(0, 0);
    const controller = new AbortController();
    const key = `ambatu-video-vote:${id}`;
    setVideo(null); setComments([]); setError(''); setCommentsError(''); setCommentsActionError(''); setCommentsLoading(true); setVideoReady(false); setDescriptionExpanded(false); setReplyingTo(null); setReplyText('');
    fetch(`${base()}/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
      .then(response => response.json().then(data => { if (!response.ok) throw new Error(data.error); return data as VideoData; }))
      .then(item => { setVideo(item); setUserVote(Number(localStorage.getItem(key)) || 0); })
      .catch(reason => { if (reason.name !== 'AbortError') setError(reason instanceof Error ? reason.message : t('watch.communityError')); });
    const anonymousId = viewerId();
    fetch(`${base()}/${encodeURIComponent(id)}/comments?anonymousId=${encodeURIComponent(anonymousId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || t('watch.communityError')); return data; })
      .then(thread => setComments(thread.comments ?? []))
      .catch(reason => { if (reason.name !== 'AbortError') setCommentsError(reason instanceof Error ? reason.message : t('watch.communityError')); })
      .finally(() => { if (!controller.signal.aborted) setCommentsLoading(false); });
    return () => controller.abort();
  }, [id, t]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function vote(value: 1 | -1) {
    if (!video) return;
    const direction = value === 1 ? 'up' : 'down';
    setVotePulse(null); requestAnimationFrame(() => setVotePulse(direction)); setTimeout(() => setVotePulse(null), 520);
    const key = `ambatu-video-vote:${id}`, prior = userVote;
    const response = await fetch(`${base()}/${encodeURIComponent(id)}/vote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ anonymousId: viewerId(), value }) });
    const data = await response.json();
    if (!response.ok) return;
    localStorage.setItem(key, String(data.value)); setUserVote(data.value);
    setVideo(current => current ? { ...current, upvotes: current.upvotes + (data.value === 1 ? 1 : 0) - (prior === 1 ? 1 : 0), downvotes: current.downvotes + (data.value === -1 ? 1 : 0) - (prior === -1 ? 1 : 0) } : current);
  }

  async function postComment(value: string, parentId?: string) {
    if (!video || !value.trim()) return;
    try {
      const token = await getIdToken();
      const response = await fetch(`${base()}/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ anonymousId: viewerId(), text: value.trim(), ...(parentId ? { parentId } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('comments.actionError'));
      setComments(items => parentId ? [...items, data] : [data, ...items]);
      setVideo(current => current ? { ...current, commentCount: current.commentCount + 1 } : current);
      setCommentsActionError('');
      if (parentId) { setReplyingTo(null); setReplyText(''); } else setText('');
    } catch {
      setCommentsActionError(t('comments.actionError'));
    }
  }

  async function submitComment(event: FormEvent) { event.preventDefault(); await postComment(text); }

  async function voteComment(commentId: string, value: 1 | -1) {
    try {
      const response = await fetch(`${base()}/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}/vote`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ anonymousId: viewerId(), value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('comments.actionError'));
      setComments(items => items.map(item => item.id === commentId ? { ...item, userVote: data.value, upvotes: data.upvotes, downvotes: data.downvotes } : item));
      setCommentsActionError('');
    } catch {
      setCommentsActionError(t('comments.actionError'));
    }
  }

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
          {video.description && <>
            <p id={`community-video-description-${video.id}`} className={`community-video-description${descriptionIsCollapsible && !descriptionExpanded ? ' is-collapsed' : ''}`}>{video.description}</p>
            {descriptionIsCollapsible && <button className="community-video-description-toggle" type="button" aria-expanded={descriptionExpanded} aria-controls={`community-video-description-${video.id}`} onClick={() => setDescriptionExpanded(expanded => !expanded)}>
              {descriptionExpanded ? <>{t('watch.showLessDescription')}<ChevronUp size={16}/></> : <>{t('watch.showMoreDescription')}<ChevronDown size={16}/></>}
            </button>}
          </>}
          <div className="community-video-actions" aria-label={t('watch.communityEyebrow')}>
            <button className={`up ${userVote === 1 ? 'selected' : ''} ${votePulse === 'up' ? 'vote-pop' : ''}`} aria-label={`${t('lore.upvote')}: ${video.upvotes}`} aria-pressed={userVote === 1} onClick={() => void vote(1)}><ArrowBigUp size={20}/><span>{video.upvotes}</span></button>
            <button className={`down ${userVote === -1 ? 'selected' : ''} ${votePulse === 'down' ? 'vote-pop' : ''}`} aria-label={`${t('lore.downvote')}: ${video.downvotes}`} aria-pressed={userVote === -1} onClick={() => void vote(-1)}><ArrowBigDown size={20}/><span>{video.downvotes}</span></button>
            <span className="community-comment-count"><MessageCircle size={19}/>{video.commentCount}</span>
          </div>
        </div>
        <section className="video-comments" aria-labelledby="video-comments-title">
          <div className="video-comments-heading"><MessageCircle size={18}/><h2 id="video-comments-title">{t('lore.comments')}</h2><span>{video.commentCount}</span></div>
          <form onSubmit={submitComment}><input aria-label={t('watch.commentPlaceholder')} value={text} maxLength={1000} onChange={event => setText(event.target.value)} placeholder={t('watch.commentPlaceholder')}/><button type="submit" aria-label={t('watch.postComment')} disabled={!text.trim()}><Send size={16}/></button></form>
          {commentsActionError && <p className="comment-action-error" role="alert">{commentsActionError}</p>}
          <div className="video-comment-list">{commentsLoading ? <div className="comments-loading"><LoadingIndicator label={t('common.loading')} compact /></div> : commentsError ? <p role="alert">{commentsError}</p> : <CommentThreadList
            comments={comments}
            currentUserId={user?.id}
            replyingTo={replyingTo}
            replyText={replyText}
            onVote={(commentId, value) => void voteComment(commentId, value)}
            onReplyStart={commentId => { setReplyingTo(commentId); setReplyText(''); }}
            onReplyTextChange={setReplyText}
            onReplyCancel={() => { setReplyingTo(null); setReplyText(''); }}
            onReplySubmit={commentId => void postComment(replyText, commentId)}
          />}</div>
        </section>
      </div>
    </article>}
  </div>;
}
