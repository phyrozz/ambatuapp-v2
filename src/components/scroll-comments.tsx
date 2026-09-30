'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Send, X } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import { CommentThreadList, type ThreadComment } from './comment-thread-list';
import { memberApi } from '@/lib/member-api';

export function ScrollComments({ clipId, title, count, onClose, onCountChange }: { clipId: string; title: string; count: number; onClose: () => void; onCountChange: () => void }) {
  const { user, getIdToken } = useAuth();
  const { t } = useI18n();
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const pane = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const load = useRef<() => void>(() => {});
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', escape); previous?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null, pending = false, done = false;
    const next = async () => {
      if (pending || done || controller.signal.aborted) return;
      pending = true; setLoading(true); setError(false);
      try {
        const data = await memberApi<{ comments: ThreadComment[]; nextCursor: string | null }>(`/scroll/${encodeURIComponent(clipId)}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, await getIdToken(), controller.signal);
        if (controller.signal.aborted) return;
        setComments(previous => [...new Map([...previous, ...data.comments].map(item => [item.id, item])).values()]);
        cursor = data.nextCursor; done = !cursor;
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { pending = false; if (!controller.signal.aborted) setLoading(false); }
    };
    load.current = () => { void next(); };
    void next();
    return () => controller.abort();
  }, [clipId, getIdToken, version]);
  useEffect(() => {
    if (!pane.current || !sentinel.current || loading || error) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) load.current(); }, { root: pane.current, rootMargin: '160px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [comments, loading, error]);
  const submit = useCallback(async (value: string, parentId?: string) => {
    if (!value.trim() || busy) return;
    setBusy(true); setActionError(false);
    try {
      const data = await memberApi<ThreadComment>(`/scroll/${encodeURIComponent(clipId)}/comments`, await getIdToken(), undefined, { text: value.trim(), ...(parentId ? { parentId } : {}) });
      setComments(previous => parentId ? [...previous, data] : [data, ...previous]);
      if (parentId) { setReplyingTo(null); setReplyText(''); } else setText('');
      onCountChange();
    } catch { setActionError(true); }
    finally { setBusy(false); }
  }, [busy, clipId, getIdToken, onCountChange]);
  const vote = useCallback(async (commentId: string, value: 1 | -1) => {
    if (busy) return;
    setBusy(true); setActionError(false);
    try {
      const result = await memberApi<{ value: number; upvotes: number; downvotes: number }>(`/scroll/${encodeURIComponent(clipId)}/comments/${encodeURIComponent(commentId)}/vote`, await getIdToken(), undefined, { value });
      setComments(previous => previous.map(item => item.id === commentId ? { ...item, userVote: result.value, upvotes: result.upvotes, downvotes: result.downvotes } : item));
    } catch { setActionError(true); }
    finally { setBusy(false); }
  }, [busy, clipId, getIdToken]);
  const submitTop = (event: FormEvent) => { event.preventDefault(); void submit(text); };
  return createPortal(<div className="scroll-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="scroll-comments-dialog video-comments" role="dialog" aria-modal="true" aria-labelledby="scroll-comments-heading" aria-describedby="scroll-comments-clip">
      <header><div><span className="eyebrow" id="scroll-comments-clip">{title}</span><h2 id="scroll-comments-heading"><MessageCircle size={21} />{t('lore.comments')}<span className="scroll-comments-count">{count}</span></h2></div><button ref={closeButton} className="scroll-dialog-close" type="button" aria-label={t('scroll.closeComments')} onClick={onClose}><X size={20}/></button></header>
      <div className="scroll-comments-pane video-comment-list" ref={pane}>
        {!loading && !comments.length && !error && <p className="scroll-comments-empty">{t('scroll.noComments')}</p>}
        <CommentThreadList comments={comments} currentUserId={user?.id} replyingTo={replyingTo} replyText={replyText} onVote={(id, value) => void vote(id, value)} onReplyStart={id => { setReplyingTo(id); setReplyText(''); }} onReplyTextChange={setReplyText} onReplyCancel={() => { setReplyingTo(null); setReplyText(''); }} onReplySubmit={id => void submit(replyText, id)} />
        {loading && <LoadingIndicator label={t('common.loading')} compact />}
        {error && <div role="alert"><p>{t('social.error')}</p><button className="button secondary compact" onClick={() => setVersion(v => v + 1)}>{t('social.retry')}</button></div>}
        <div ref={sentinel} className="scroll-comments-sentinel" />
      </div>
      {actionError && <p className="comment-action-error" role="alert">{t('comments.actionError')}</p>}
      <form className="scroll-comment-compose" onSubmit={submitTop}><input value={text} maxLength={1000} onChange={event => setText(event.target.value)} placeholder={t('watch.commentPlaceholder')} aria-label={t('watch.commentPlaceholder')} /><button type="submit" disabled={!text.trim() || busy} aria-label={t('watch.postComment')}><Send size={18}/></button></form>
    </section>
  </div>, document.body);
}
