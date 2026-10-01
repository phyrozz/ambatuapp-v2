'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { ArrowBigDown, ArrowBigUp, ChevronDown, ChevronUp, MessageCircle, Pause, Play, Send, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { ScrollComments } from './scroll-comments';
import { memberApi } from '@/lib/member-api';
import { LoadingIndicator } from './loading-indicator';
import { FriendShareDialog } from './friend-share-dialog';
import { publicAppUrl } from '@/lib/share-links';

type Clip = { id: string; title: string; description: string; uploader: string; uploaderId: string | null; uploaderAvatarUrl: string | null; videoUrl: string; thumbnailUrl: string; upvotes: number; downvotes: number; commentCount: number; userVote: number };
type VoteResult = { value: number; upvotes: number; downvotes: number };

function ScrollClip({ clip, root, muted, dialogOpen, toggleMute, openComments, onShare, onVote }: { clip: Clip; root: HTMLDivElement | null; muted: boolean; dialogOpen: boolean; toggleMute: () => void; openComments: () => void; onShare: () => void; onVote: (value: 1 | -1) => Promise<void> }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const article = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const deliberatePause = useRef(false);
  const [deliberatelyPaused, setDeliberatelyPaused] = useState(false);
  const lastTouch = useRef<{ time: number; x: number; y: number } | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [near, setNear] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(true);
  const [progress, setProgress] = useState(0);
  const [voteBusy, setVoteBusy] = useState(false);
  const [votePulse, setVotePulse] = useState(false);
  const [voteError, setVoteError] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const descriptionCanExpand = clip.description.length > 240 || clip.description.split(/\r?\n/).length > 5;
  const uploaderInitial = clip.uploader.trim().charAt(0).toLocaleUpperCase() || 'A';
  const uploaderAvatar = clip.uploaderAvatarUrl && !avatarFailed
    ? <img src={clip.uploaderAvatarUrl} alt="" onError={() => setAvatarFailed(true)} />
    : <span aria-hidden="true">{uploaderInitial}</span>;
  useEffect(() => {
    const element = article.current;
    if (!element || !root) return;
    let visible = false;
    const play = () => {
      const player = video.current;
      if (!player) return;
      if (visible && !document.hidden && !dialogOpen && !deliberatePause.current) void player.play().catch(() => {});
      else player.pause();
    };
    const activeObserver = new IntersectionObserver(entries => { visible = entries[0].intersectionRatio >= 0.65; setActive(visible); play(); }, { root, threshold: [0, 0.65] });
    const preload = new IntersectionObserver(entries => setNear(entries[0].isIntersecting), { root, rootMargin: '100% 0px' });
    activeObserver.observe(element); preload.observe(element);
    document.addEventListener('visibilitychange', play);
    const media = video.current;
    return () => { activeObserver.disconnect(); preload.disconnect(); document.removeEventListener('visibilitychange', play); media?.pause(); };
  }, [root, dialogOpen]);
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    if (!active || !near || dialogOpen || deliberatePause.current || document.hidden) {
      if (!player.paused) player.pause();
      return;
    }
    void player.play().catch(() => { if (player.paused) setPaused(true); });
  }, [active, near, mediaReady, dialogOpen, muted]);
  const vote = useCallback(async (value: 1 | -1) => {
    if (voteBusy) return;
    setVoteBusy(true); setVoteError(false);
    if (value === 1) { setVotePulse(true); window.setTimeout(() => setVotePulse(false), 550); }
    try {
      await onVote(value);
    } catch { setVoteError(true); }
    finally { setVoteBusy(false); }
  }, [onVote, voteBusy]);
  const handleTouch = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch' || (event.target as Element).closest('button,a')) return;
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 16) { lastTouch.current = null; return; }
    const now = Date.now(), last = lastTouch.current;
    if (last && now - last.time < 320 && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 35) {
      lastTouch.current = null; if (clip.userVote !== 1) void vote(1);
    } else lastTouch.current = { time: now, x: event.clientX, y: event.clientY };
  };
  const togglePlay = () => {
    const player = video.current;
    if (!player) return;
    deliberatePause.current = !player.paused;
    setDeliberatelyPaused(deliberatePause.current);
    if (deliberatePause.current) player.pause(); else void player.play().catch(() => {});
  };
  return <article ref={article} className={`scroll-clip ${active ? 'is-active' : ''}`} aria-label={clip.title} onPointerDown={event => { if (event.pointerType === 'touch') touchStart.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={handleTouch} onDoubleClick={event => { if (clip.userVote !== 1 && !(event.target as Element).closest('button,a')) void vote(1); }}>
    <video ref={video} src={near ? clip.videoUrl : undefined} poster={clip.thumbnailUrl || undefined} playsInline autoPlay={active && !dialogOpen && !deliberatelyPaused} loop muted={muted} preload="metadata" aria-label={clip.title} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onTimeUpdate={event => { const player = event.currentTarget; if (player.duration) setProgress(player.currentTime / player.duration); }} onError={() => setFailed(true)} onCanPlay={() => { setMediaReady(true); if (active && !dialogOpen && !deliberatePause.current && !document.hidden) void video.current?.play().catch(() => {}); }} />
    <div className={`scroll-caption${descriptionExpanded ? ' is-expanded' : ''}`}>
      <h2><Link href={`/watch/${encodeURIComponent(clip.id)}/`}>{clip.title}</Link></h2>
      {clip.description && <>
        <p id={`scroll-description-${clip.id}`} className={`scroll-description${descriptionCanExpand && !descriptionExpanded ? ' is-collapsed' : ''}`}>{clip.description}</p>
        {descriptionCanExpand && <button className="scroll-description-toggle" type="button" aria-expanded={descriptionExpanded} aria-controls={`scroll-description-${clip.id}`} onClick={() => setDescriptionExpanded(value => !value)}>
          {descriptionExpanded ? <>{t('watch.showLessDescription')}<ChevronUp size={15}/></> : <>{t('watch.showMoreDescription')}<ChevronDown size={15}/></>}
        </button>}
      </>}
      {failed && <p role="alert">{t('scroll.playbackError')}</p>}{voteError && <p role="alert">{t('scroll.voteError')}</p>}
    </div>
    <div className="scroll-actions" aria-label={clip.title}>
      {clip.uploaderId && clip.uploaderId !== user?.id
        ? <Link className="scroll-uploader-avatar" href={`/chat/?user=${encodeURIComponent(clip.uploaderId)}&name=${encodeURIComponent(clip.uploader)}`} aria-label={t('chat.messageUser', { name: clip.uploader })} title={clip.uploader}>{uploaderAvatar}</Link>
        : <span className="scroll-uploader-avatar" aria-hidden="true" title={clip.uploader}>{uploaderAvatar}</span>}
      <button type="button" className={`scroll-action ${clip.userVote === 1 ? 'selected' : ''}`} aria-label={`${t('lore.upvote')}: ${clip.upvotes}`} aria-pressed={clip.userVote === 1} disabled={voteBusy} onClick={() => void vote(1)}><ArrowBigUp size={27}/><span>{clip.upvotes}</span></button>
      <button type="button" className={`scroll-action ${clip.userVote === -1 ? 'selected' : ''}`} aria-label={`${t('lore.downvote')}: ${clip.downvotes}`} aria-pressed={clip.userVote === -1} disabled={voteBusy} onClick={() => void vote(-1)}><ArrowBigDown size={27}/><span>{clip.downvotes}</span></button>
      <button type="button" className="scroll-action" aria-label={`${t('lore.comments')}: ${clip.commentCount}`} onClick={openComments}><MessageCircle size={26}/><span>{clip.commentCount}</span></button>
      <button type="button" className="scroll-action" aria-label={t('friends.shareClip')} onClick={onShare}><Send size={25}/></button>
    </div>
    <button type="button" className="scroll-play" onClick={togglePlay} aria-label={t(paused ? 'scroll.play' : 'scroll.pause')}>{paused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}</button>
    <button type="button" className="scroll-mute" onClick={toggleMute} aria-label={t(muted ? 'scroll.unmute' : 'scroll.mute')}>{muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}</button>
    <div className="scroll-progress" aria-hidden="true"><span style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} /></div>
    {votePulse && <div className="scroll-vote-pulse" aria-hidden="true"><ArrowBigUp size={64} fill="currentColor"/></div>}
  </article>;
}

export function Ambatuscroll() {
  const { t } = useI18n();
  const { getIdToken } = useAuth();
  const [clips, setClips] = useState<Clip[]>([]);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [commentClipId, setCommentClipId] = useState<string | null>(null);
  const [shareClip, setShareClip] = useState<Clip | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const load = useRef<() => void>(() => {});
  const setFeed = useCallback((element: HTMLDivElement | null) => {
    feedRef.current = element;
    setRoot(element);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null, pending = false, done = false, firstBatch = true;
    const next = async () => {
      if (pending || done || controller.signal.aborted) return;
      pending = true; setLoading(true); setError(false);
      try {
        const data = await memberApi<{ videos: Clip[]; nextCursor: string | null }>(`/scroll${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, await getIdToken(), controller.signal);
        if (controller.signal.aborted) return;
        setClips(previous => [...new Map([...previous, ...data.videos].map(clip => [clip.id, clip])).values()]);
        if (firstBatch) {
          firstBatch = false;
          requestAnimationFrame(() => feedRef.current?.scrollTo(0, 0));
        }
        cursor = data.nextCursor; done = !cursor; setEnded(done);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { pending = false; if (!controller.signal.aborted) setLoading(false); }
    };
    load.current = () => { void next(); };
    void next();
    return () => controller.abort();
  }, [getIdToken]);
  useEffect(() => {
    if (!root || !sentinel.current || loading || error || ended) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) load.current(); }, { root });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [root, clips, loading, error, ended]);
  const vote = useCallback(async (id: string, value: 1 | -1) => {
    const before = clips.find(clip => clip.id === id);
    if (!before) return;
    const prior = before.userVote ?? 0;
    const next = prior === value ? 0 : value;
    setClips(previous => previous.map(clip => clip.id === id ? {
      ...clip,
      userVote: next,
      upvotes: clip.upvotes + (next === 1 ? 1 : 0) - (prior === 1 ? 1 : 0),
      downvotes: clip.downvotes + (next === -1 ? 1 : 0) - (prior === -1 ? 1 : 0),
    } : clip));
    try {
      const result = await memberApi<VoteResult>(`/scroll/${encodeURIComponent(id)}/vote`, await getIdToken(), undefined, { value });
      setClips(previous => previous.map(clip => clip.id === id ? { ...clip, userVote: result.value, upvotes: result.upvotes, downvotes: result.downvotes } : clip));
    } catch (error) {
      setClips(previous => previous.map(clip => clip.id === id ? { ...clip, userVote: before.userVote, upvotes: before.upvotes, downvotes: before.downvotes } : clip));
      throw error;
    }
  }, [clips, getIdToken]);
  const currentClip = clips.find(clip => clip.id === commentClipId);
  return <section className="ambatuscroll"><AmbatuscrollHeader />
    <div className="scroll-feed" ref={setFeed} tabIndex={0} aria-label={t('nav.scroll')}>
      {clips.map(clip => <ScrollClip key={clip.id} clip={clip} root={root} muted={muted} dialogOpen={!!shareClip || !!commentClipId} toggleMute={() => setMuted(value => !value)} openComments={() => setCommentClipId(clip.id)} onShare={() => setShareClip(clip)} onVote={value => vote(clip.id, value)} />)}
      <div ref={sentinel} className={`scroll-status${ended ? ' scroll-status-end' : ''}${ended && !clips.length ? ' scroll-status-empty' : ''}`}>{loading && <LoadingIndicator label={t('common.loading')} />}{error && <><p role="alert">{t('social.error')}</p><button className="button dark" onClick={() => load.current()}>{t('social.retry')}</button></>}{ended && <p>{t(clips.length ? 'scroll.end' : 'scroll.empty')}</p>}</div>
    </div>
    {currentClip && <ScrollComments clipId={currentClip.id} title={currentClip.title} count={currentClip.commentCount} onClose={() => setCommentClipId(null)} onCountChange={() => setClips(previous => previous.map(clip => clip.id === currentClip.id ? { ...clip, commentCount: clip.commentCount + 1 } : clip))} />}
    {shareClip && <FriendShareDialog kind="clip" title={shareClip.title} message={t('friends.clipMessage', { title: shareClip.title.slice(0, 300), url: publicAppUrl(`/watch/${encodeURIComponent(shareClip.id)}/`) })} onClose={() => setShareClip(null)}/>}
  </section>;
}

export function AmbatuscrollHeader() {
  const { t } = useI18n();
  return <header className="ambatuscroll-header"><div className="ambatuscroll-brand-group"><span className="ambatuscroll-brand">ambatu<span className="orange-text">app</span></span><h1>{t('nav.scroll')}<span className="orange-text">.</span></h1></div><Link className="scroll-profile-button" href="/profile/">{t('nav.profile')}</Link></header>;
}
