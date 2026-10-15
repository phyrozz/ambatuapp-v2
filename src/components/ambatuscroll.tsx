'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowBigDown, ArrowBigUp, ArrowLeft, Check, ChevronDown, ChevronUp, CircleUserRound, Download, Gauge, MessageCircle, Pause, Pencil, Play, Send, Upload, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { ScrollComments } from './scroll-comments';
import { memberApi } from '@/lib/member-api';
import { LoadingIndicator } from './loading-indicator';
import { FriendShareDialog } from './friend-share-dialog';
import { VideoUploadDialog } from './video-upload-dialog';
import { publicAppUrl } from '@/lib/share-links';
import { creatorHref } from '@/lib/creator-profile';
import { CreatorSearch } from './creator-search';
import { VideoManageDialog } from './video-manage-dialog';

type Clip = { id: string; title: string; description: string; uploader: string; uploaderId: string | null; uploaderAvatarUrl: string | null; videoUrl: string; downloadUrl?: string; thumbnailUrl: string; upvotes: number; downvotes: number; commentCount: number; userVote: number };
type VoteResult = { value: number; upvotes: number; downvotes: number };

function ScrollClip({ clip, root, muted, dialogOpen, toggleMute, openComments, onShare, onVote, isOwner, onManage, singleClip = false }: { clip: Clip; root: HTMLDivElement | null; muted: boolean; dialogOpen: boolean; toggleMute: () => void; openComments: () => void; onShare: () => void; onVote: (value: 1 | -1) => Promise<void>; isOwner: boolean; onManage: () => void; singleClip?: boolean }) {
  const { t } = useI18n();
  const article = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const deliberatePause = useRef(false);
  const [deliberatelyPaused, setDeliberatelyPaused] = useState(false);
  const lastVideoTap = useRef<{ time: number; x: number; y: number; windowMs: number } | null>(null);
  const videoPointerStart = useRef<{ x: number; y: number } | null>(null);
  const videoTapTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const contextMenuElement = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(true);
  const [progress, setProgress] = useState(0);
  const [votePulse, setVotePulse] = useState<{ size: 'regular' | 'large'; id: number } | null>(null);
  const [videoMenu, setVideoMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const votePulseSequence = useRef(0);
  const votePulseTimer = useRef<number | null>(null);
  const [voteError, setVoteError] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => () => {
    if (votePulseTimer.current !== null) window.clearTimeout(votePulseTimer.current);
    if (videoTapTimer.current !== null) window.clearTimeout(videoTapTimer.current);
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
  }, []);
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
  useEffect(() => { if (video.current) video.current.playbackRate = playbackRate; }, [playbackRate]);
  useEffect(() => {
    if (!videoMenu) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVideoMenu(false);
      if (event.key !== 'Tab') return;
      const buttons = contextMenuElement.current?.querySelectorAll<HTMLButtonElement>('button');
      const first = buttons?.[0], last = buttons?.[buttons.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', closeOnKeyDown);
    contextMenuElement.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [videoMenu]);
  useEffect(() => { if (dialogOpen) setVideoMenu(false); }, [dialogOpen]);
  const showVotePulse = useCallback((size: 'regular' | 'large') => {
    const id = ++votePulseSequence.current;
    setVotePulse({ size, id });
    if (votePulseTimer.current !== null) window.clearTimeout(votePulseTimer.current);
    votePulseTimer.current = window.setTimeout(() => setVotePulse(current => current?.id === id ? null : current), 550);
  }, []);
  const vote = useCallback(async (value: 1 | -1, largePulse = false) => {
    setVoteError(false);
    if (value === 1) showVotePulse(largePulse ? 'large' : 'regular');
    try {
      await onVote(value);
    } catch { setVoteError(true); }
  }, [onVote, showVotePulse]);
  const openVideoMenu = () => {
    if (videoTapTimer.current !== null) window.clearTimeout(videoTapTimer.current);
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    videoTapTimer.current = null;
    longPressTimer.current = null;
    lastVideoTap.current = null;
    videoPointerStart.current = null;
    setVideoMenu(true);
  };
  const handleVideoPointerDown = (event: ReactPointerEvent<HTMLVideoElement>) => {
    videoPointerStart.current = { x: event.clientX, y: event.clientY };
    longPressTriggered.current = false;
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    if (event.pointerType !== 'mouse' && event.button === 0) {
      longPressTimer.current = window.setTimeout(() => {
        longPressTimer.current = null;
        longPressTriggered.current = true;
        openVideoMenu();
      }, 520);
    }
  };
  const handleVideoPointerMove = (event: ReactPointerEvent<HTMLVideoElement>) => {
    const start = videoPointerStart.current;
    if (longPressTimer.current !== null && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleVideoPointerUp = (event: ReactPointerEvent<HTMLVideoElement>) => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      videoPointerStart.current = null;
      lastVideoTap.current = null;
      return;
    }
    const start = videoPointerStart.current;
    videoPointerStart.current = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 16) { lastVideoTap.current = null; return; }
    const now = Date.now(), last = lastVideoTap.current;
    const tapWindow = event.pointerType === 'touch' ? 320 : 450;
    if (last && videoTapTimer.current !== null && now - last.time < last.windowMs && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 35) {
      window.clearTimeout(videoTapTimer.current);
      videoTapTimer.current = null;
      lastVideoTap.current = null;
      setVoteError(false);
      if (clip.userVote === 1) showVotePulse('large');
      else void vote(1, true);
    } else {
      if (videoTapTimer.current !== null) {
        window.clearTimeout(videoTapTimer.current);
        videoTapTimer.current = null;
        togglePlay();
      }
      lastVideoTap.current = { time: now, x: event.clientX, y: event.clientY, windowMs: tapWindow };
      videoTapTimer.current = window.setTimeout(() => {
        videoTapTimer.current = null;
        lastVideoTap.current = null;
        togglePlay();
      }, tapWindow);
    }
  };
  const togglePlay = () => {
    const player = video.current;
    if (!player) return;
    deliberatePause.current = !player.paused;
    setDeliberatelyPaused(deliberatePause.current);
    if (deliberatePause.current) player.pause(); else void player.play().catch(() => {});
  };
  return <article ref={article} className={`scroll-clip ${active ? 'is-active' : ''}`} aria-label={clip.title}>
    <video ref={video} src={near ? clip.videoUrl : undefined} poster={clip.thumbnailUrl || undefined} playsInline autoPlay={active && !dialogOpen && !deliberatelyPaused} loop muted={muted} preload="metadata" aria-label={clip.title} onPointerDown={handleVideoPointerDown} onPointerMove={handleVideoPointerMove} onPointerUp={handleVideoPointerUp} onPointerCancel={() => { if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current); longPressTimer.current = null; videoPointerStart.current = null; lastVideoTap.current = null; }} onContextMenu={event => { event.preventDefault(); openVideoMenu(); }} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onTimeUpdate={event => { const player = event.currentTarget; if (player.duration) setProgress(player.currentTime / player.duration); }} onError={() => setFailed(true)} onCanPlay={() => { setMediaReady(true); if (active && !dialogOpen && !deliberatePause.current && !document.hidden) void video.current?.play().catch(() => {}); }} />
    <div className={`scroll-caption${descriptionExpanded ? ' is-expanded' : ''}`}>
      {clip.uploaderId && <Link className="scroll-uploader-name" href={creatorHref(clip.uploaderId)} aria-label={t('creator.view', { name:clip.uploader })}>{clip.uploader}</Link>}
      <h2>{singleClip ? clip.title : <Link href={`/watch/${encodeURIComponent(clip.id)}/`}>{clip.title}</Link>}</h2>
      {clip.description && <>
        <p id={`scroll-description-${clip.id}`} className={`scroll-description${descriptionCanExpand && !descriptionExpanded ? ' is-collapsed' : ''}`}>{clip.description}</p>
        {descriptionCanExpand && <button className="scroll-description-toggle" type="button" aria-expanded={descriptionExpanded} aria-controls={`scroll-description-${clip.id}`} onClick={() => setDescriptionExpanded(value => !value)}>
          {descriptionExpanded ? <>{t('watch.showLessDescription')}<ChevronUp size={15}/></> : <>{t('watch.showMoreDescription')}<ChevronDown size={15}/></>}
        </button>}
      </>}
      {isOwner && <button type="button" className="scroll-owner-manage" onClick={onManage}><Pencil size={14}/>{t('watch.manageVideo')}</button>}
      {failed && <p role="alert">{t('scroll.playbackError')}</p>}{voteError && <p role="alert">{t('scroll.voteError')}</p>}
    </div>
    <div className="scroll-actions" aria-label={clip.title}>
      {clip.uploaderId
        ? <Link className="scroll-uploader-avatar" href={creatorHref(clip.uploaderId)} aria-label={t('creator.view', { name: clip.uploader })} title={clip.uploader}>{uploaderAvatar}</Link>
        : <span className="scroll-uploader-avatar" aria-hidden="true" title={clip.uploader}>{uploaderAvatar}</span>}
      <button type="button" className={`scroll-action ${clip.userVote === 1 ? 'selected' : ''}`} aria-label={`${t('lore.upvote')}: ${clip.upvotes}`} aria-pressed={clip.userVote === 1} onClick={() => void vote(1)}><ArrowBigUp size={27}/><span>{clip.upvotes}</span></button>
      <button type="button" className={`scroll-action ${clip.userVote === -1 ? 'selected' : ''}`} aria-label={`${t('lore.downvote')}: ${clip.downvotes}`} aria-pressed={clip.userVote === -1} onClick={() => void vote(-1)}><ArrowBigDown size={27}/><span>{clip.downvotes}</span></button>
      <button type="button" className="scroll-action" aria-label={`${t('lore.comments')}: ${clip.commentCount}`} onClick={openComments}><MessageCircle size={26}/><span>{clip.commentCount}</span></button>
      <button type="button" className="scroll-action" aria-label={t('friends.shareClip')} onClick={onShare}><Send size={25}/></button>
    </div>
    <button type="button" className="scroll-play" onClick={togglePlay} aria-label={t(paused ? 'scroll.play' : 'scroll.pause')}>{paused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}</button>
    <button type="button" className="scroll-mute" onClick={toggleMute} aria-label={t(muted ? 'scroll.unmute' : 'scroll.mute')}>{muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}</button>
    <div className="scroll-progress" aria-hidden="true"><span style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} /></div>
    {votePulse && <div key={votePulse.id} className={`scroll-vote-pulse${votePulse.size === 'large' ? ' is-large' : ''}`} aria-hidden="true"><ArrowBigUp size={votePulse.size === 'large' ? 104 : 64} fill="currentColor"/></div>}
    {videoMenu && createPortal(<div className="scroll-video-sheet-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setVideoMenu(false); }}>
      <div ref={contextMenuElement} className="scroll-video-context-menu" role="dialog" aria-modal="true" aria-labelledby={`scroll-video-options-${clip.id}`}>
        <div className="scroll-video-sheet-handle" aria-hidden="true" />
        <h2 id={`scroll-video-options-${clip.id}`} className="scroll-video-sheet-title">{t('scroll.videoOptions')}</h2>
        <div className="scroll-video-context-actions">
          <button type="button" className="scroll-video-context-action" onClick={() => {
            const link = document.createElement('a');
            link.href = clip.downloadUrl || clip.videoUrl;
            link.download = `${clip.id}.mp4`;
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setVideoMenu(false);
          }}><span className="scroll-video-context-icon"><Download size={25}/></span><span>{t('scroll.downloadVideo')}</span></button>
          <button type="button" className="scroll-video-context-action" onClick={() => { setVideoMenu(false); onShare(); }}><span className="scroll-video-context-icon"><Send size={25}/></span><span>{t('friends.shareClip')}</span></button>
        </div>
        <div className="scroll-video-context-speeds" role="group" aria-label={t('scroll.playbackSpeed')}>
          <span className="scroll-video-context-heading"><Gauge size={17}/>{t('scroll.playbackSpeed')}</span>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => <button key={rate} type="button" aria-pressed={playbackRate === rate} className="scroll-video-context-speed" onClick={() => setPlaybackRate(rate)}><span>{rate}×</span>{playbackRate === rate && <Check size={16}/>}</button>)}
        </div>
        <button type="button" className="scroll-video-sheet-cancel" onClick={() => setVideoMenu(false)}>{t('friends.cancelAction')}</button>
      </div>
    </div>, document.body)}
  </article>;
}

export function Ambatuscroll() {
  const { t } = useI18n();
  const { getIdToken, user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const singleClipId = params.get('clip') ?? '';
  const returnConversation = params.get('conversation') ?? '';
  const returnCreator = params.get('creator') ?? '';
  const validReturnCreator = /^[\w-]{1,128}$/.test(returnCreator) && returnCreator !== 'admin';
  const returnHref = validReturnCreator ? creatorHref(returnCreator) : returnConversation ? `/chat/?conversation=${encodeURIComponent(returnConversation)}` : '/chat/';
  const [clips, setClips] = useState<Clip[]>([]);
  const voteRequestIds = useRef(new Map<string, number>());
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [commentClipId, setCommentClipId] = useState<string | null>(null);
  const [shareClip, setShareClip] = useState<Clip | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [managingClip, setManagingClip] = useState<Clip | null>(null);
  const [searchActive, setSearchActive] = useState(false);
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
        if (singleClipId) {
          setClips([]);
          const clip = await memberApi<Clip>(`/scroll/${encodeURIComponent(singleClipId)}`, await getIdToken(), controller.signal);
          if (controller.signal.aborted) return;
          setClips([clip]); setEnded(true);
          return;
        }
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
  }, [getIdToken, singleClipId]);
  useEffect(() => {
    if (singleClipId || !root || !sentinel.current || loading || error || ended) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) load.current(); }, { root });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [root, clips, loading, error, ended, singleClipId]);
  const vote = useCallback(async (id: string, value: 1 | -1) => {
    setClips(previous => previous.map(clip => {
      if (clip.id !== id) return clip;
      const prior = clip.userVote ?? 0;
      const next = prior === value ? 0 : value;
      return {
        ...clip,
        userVote: next,
        upvotes: clip.upvotes + (next === 1 ? 1 : 0) - (prior === 1 ? 1 : 0),
        downvotes: clip.downvotes + (next === -1 ? 1 : 0) - (prior === -1 ? 1 : 0),
      };
    }));
    const requestId = (voteRequestIds.current.get(id) ?? 0) + 1;
    voteRequestIds.current.set(id, requestId);
    const result = await memberApi<VoteResult>(`/scroll/${encodeURIComponent(id)}/vote`, await getIdToken(), undefined, { value });
    if (voteRequestIds.current.get(id) === requestId) {
      setClips(previous => previous.map(clip => clip.id === id ? { ...clip, userVote: result.value, upvotes: result.upvotes, downvotes: result.downvotes } : clip));
    }
  }, [getIdToken]);
  const currentClip = clips.find(clip => clip.id === commentClipId);
  return <section className={`ambatuscroll has-creator-search${singleClipId ? ' is-single' : ''}`}><AmbatuscrollHeader backHref={singleClipId ? returnHref : undefined} backLabel={validReturnCreator ? 'creator.backToProfile' : undefined} onUpload={singleClipId ? undefined : () => setUploadOpen(true)} />
    {!singleClipId && <CreatorSearch onActiveChange={setSearchActive}/>}
    <div className={`scroll-feed${singleClipId ? ' is-single' : ''}`} ref={setFeed} tabIndex={singleClipId ? undefined : 0} aria-label={t('nav.scroll')}>
      {clips.map(clip => <ScrollClip key={clip.id} clip={clip} root={root} muted={muted} dialogOpen={!!shareClip || !!commentClipId || !!managingClip || uploadOpen || searchActive} toggleMute={() => setMuted(value => !value)} openComments={() => setCommentClipId(clip.id)} onShare={() => setShareClip(clip)} onVote={value => vote(clip.id, value)} isOwner={clip.uploaderId === user?.id} onManage={() => setManagingClip(clip)} singleClip={!!singleClipId} />)}
      {singleClipId ? (loading || error) && <div className="scroll-status scroll-single-status" aria-live="polite">{loading && <LoadingIndicator label={t('common.loading')} />}{error && <><p role="alert">{t('social.error')}</p><button className="button dark" onClick={() => load.current()}>{t('social.retry')}</button></>}</div> : <div ref={sentinel} className={`scroll-status${ended ? ' scroll-status-end' : ''}${ended && !clips.length ? ' scroll-status-empty' : ''}`}>{loading && <LoadingIndicator label={t('common.loading')} />}{error && <><p role="alert">{t('social.error')}</p><button className="button dark" onClick={() => load.current()}>{t('social.retry')}</button></>}{ended && <p>{t(clips.length ? 'scroll.end' : 'scroll.empty')}</p>}</div>}
    </div>
    {currentClip && <ScrollComments clipId={currentClip.id} title={currentClip.title} count={currentClip.commentCount} onClose={() => setCommentClipId(null)} onCountChange={() => setClips(previous => previous.map(clip => clip.id === currentClip.id ? { ...clip, commentCount: clip.commentCount + 1 } : clip))} />}
    {shareClip && <FriendShareDialog kind="clip" title={shareClip.title} message={t('friends.clipMessage', { title: shareClip.title.slice(0, 300), url: publicAppUrl(`/watch/${encodeURIComponent(shareClip.id)}/`) })} onClose={() => setShareClip(null)}/>}
    {uploadOpen && <VideoUploadDialog onClose={() => setUploadOpen(false)} onPublished={video => {
      window.dispatchEvent(new Event('ambatu:clips-changed'));
      const clip: Clip = video;
      setClips(previous => [clip, ...previous.filter(item => item.id !== clip.id)]);
      setError(false);
      requestAnimationFrame(() => feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
    }}/>}
    {managingClip && <VideoManageDialog video={managingClip} onClose={() => setManagingClip(null)} onSaved={updated => {
      setClips(previous => previous.map(clip => clip.id === managingClip.id ? { ...clip, ...updated } : clip));
      setShareClip(current => current?.id === managingClip.id ? { ...current, ...updated } : current);
      setManagingClip(null);
      window.dispatchEvent(new Event('ambatu:clips-changed'));
    }} onDeleted={() => {
      const deletedId = managingClip.id;
      setClips(previous => previous.filter(clip => clip.id !== deletedId));
      setShareClip(current => current?.id === deletedId ? null : current);
      setCommentClipId(current => current === deletedId ? null : current);
      setManagingClip(null);
      window.dispatchEvent(new Event('ambatu:clips-changed'));
      if (singleClipId) router.replace(validReturnCreator || returnConversation ? returnHref : '/scroll/');
    }} />}
  </section>;
}

export function AmbatuscrollHeader({ backHref, backLabel = 'chat.inbox', onUpload }: { backHref?: string; backLabel?: string; onUpload?: () => void }) {
  const { t } = useI18n();
  return <header className="ambatuscroll-header">{backHref ? <Link className="scroll-chat-back" href={backHref}><ArrowLeft size={18}/>{t(backLabel)}</Link> : <div className="ambatuscroll-brand-group"><span className="ambatuscroll-brand">ambatu<span className="orange-text">app</span></span><h1>{t('nav.scroll')}<span className="orange-text">.</span></h1></div>}{backHref ? <span className="scroll-single-title">{t('nav.scroll')}</span> : <div className="ambatuscroll-header-actions">{onUpload && <button type="button" className="scroll-upload-button" onClick={onUpload} aria-label={t('watch.upload')}><span className="scroll-upload-icon"><Upload size={16} aria-hidden="true"/></span><span>{t('watch.upload')}</span></button>}<Link className="scroll-profile-button" href="/profile/" aria-label={t('nav.profile')} title={t('nav.profile')}><span className="scroll-profile-icon"><CircleUserRound size={16} aria-hidden="true"/></span></Link></div>}</header>;
}
