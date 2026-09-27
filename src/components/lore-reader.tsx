'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowBigDown, ArrowBigUp, ArrowLeft, Languages, LogIn, MessageCircle, Send, X } from 'lucide-react';
import { LoadingIndicator } from './loading-indicator';
import { useI18n } from './i18n-provider';
import { AppSelect, languageFlag } from './app-select';
import { useAuth } from './auth-provider';
import { CommentThreadList, type ThreadComment } from './comment-thread-list';

type Translation = { locale: string; label: string; title: string; text: string };
type Lore = { id: string; title: string; text: string; translations?: Translation[]; tags: string[]; imageUrls: string[]; upvotes: number; downvotes: number; commentCount: number; userVote?: number };
type Comment = ThreadComment & { createdAt: string | null };
type Pending =
  | { type: 'vote'; value: 1 | -1; id: string }
  | { type: 'comment'; text: string; id: string }
  | { type: 'commentVote'; commentId: string; value: 1 | -1; id: string }
  | { type: 'commentReply'; commentId: string; text: string; id: string };

const base = () => process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? '';
const pendingKey = 'ambatuapp-lore-pending-action';

export function LoreReader({ id }: { id: string }) {
  const { t } = useI18n();
  const { user, getIdToken, signInWithGoogle } = useAuth();
  const [lore, setLore] = useState<Lore | null>(null);
  const [locale, setLocale] = useState('original');
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [commentsActionError, setCommentsActionError] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  async function load() {
    const token = await getIdToken();
    const response = await fetch(`${base()}/lores/${encodeURIComponent(id)}`, { cache: 'no-store', headers: token ? { authorization: `Bearer ${token}` } : {} });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t('lore.notFound'));
    setLore(data);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    setComments([]);
    setCommentsLoaded(false);
    setCommentsOpen(false);
    setReplyingTo(null);
    setReplyText('');
    void load().catch(reason => setError(reason instanceof Error ? reason.message : t('lore.notFound'))).finally(() => setLoading(false));
  }, [id, user]);

  const requireLogin = (action: Pending) => {
    sessionStorage.setItem(pendingKey, JSON.stringify(action));
    setLoginOpen(true);
  };

  async function vote(value: 1 | -1) {
    if (!user) return requireLogin({ type: 'vote', value, id });
    const token = await getIdToken();
    if (!token) return requireLogin({ type: 'vote', value, id });
    const response = await fetch(`${base()}/lores/${id}/vote`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ value }) });
    const data = await response.json();
    if (response.ok && lore) {
      const prior = lore.userVote ?? 0;
      const next = data.value ?? 0;
      setLore({ ...lore, upvotes: lore.upvotes + (next === 1 ? 1 : 0) - (prior === 1 ? 1 : 0), downvotes: lore.downvotes + (next === -1 ? 1 : 0) - (prior === -1 ? 1 : 0), userVote: next });
    }
  }

  async function loadComments() {
    setCommentsLoading(true);
    setCommentsError('');
    try {
      const token = await getIdToken();
      const response = await fetch(`${base()}/lores/${encodeURIComponent(id)}/comments`, { cache: 'no-store', headers: token ? { authorization: `Bearer ${token}` } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('lore.loadError'));
      setComments(data.comments ?? []);
      setCommentsLoaded(true);
      return true;
    } catch (reason) {
      setCommentsError(reason instanceof Error ? reason.message : t('lore.loadError'));
      return false;
    } finally {
      setCommentsLoading(false);
    }
  }

  async function openComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && !commentsLoaded && !commentsLoading) await loadComments();
  }

  async function post(value: string, parentId?: string) {
    const cleanText = value.trim();
    if (!cleanText) return false;
    if (!user) {
      requireLogin(parentId ? { type: 'commentReply', commentId: parentId, text: cleanText, id } : { type: 'comment', text: cleanText, id });
      return false;
    }
    const token = await getIdToken();
    if (!token) {
      requireLogin(parentId ? { type: 'commentReply', commentId: parentId, text: cleanText, id } : { type: 'comment', text: cleanText, id });
      return false;
    }
    try {
      const response = await fetch(`${base()}/lores/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: cleanText, ...(parentId ? { parentId } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('comments.actionError'));
      setComments(items => [data, ...items]);
      setLore(current => current ? { ...current, commentCount: current.commentCount + 1 } : current);
      setCommentsActionError('');
      if (parentId) { setReplyingTo(null); setReplyText(''); } else setText('');
      return true;
    } catch {
      setCommentsActionError(t('comments.actionError'));
      return false;
    }
  }

  async function voteComment(commentId: string, value: 1 | -1) {
    if (!user) return requireLogin({ type: 'commentVote', commentId, value, id });
    const token = await getIdToken();
    if (!token) return requireLogin({ type: 'commentVote', commentId, value, id });
    try {
      const response = await fetch(`${base()}/lores/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('comments.actionError'));
      setComments(items => items.map(item => item.id === commentId ? { ...item, userVote: data.value, upvotes: data.upvotes, downvotes: data.downvotes } : item));
      setCommentsActionError('');
    } catch {
      setCommentsActionError(t('comments.actionError'));
    }
  }

  useEffect(() => {
    if (!user) return;
    try {
      const pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null') as Pending | null;
      if (!pending || pending.id !== id) return;
      sessionStorage.removeItem(pendingKey);
      if (pending.type === 'vote') void vote(pending.value);
      if (pending.type === 'commentVote') void voteComment(pending.commentId, pending.value);
      if (pending.type === 'comment' || pending.type === 'commentReply') {
        setCommentsOpen(true);
        if (pending.type === 'commentReply') { setReplyingTo(pending.commentId); setReplyText(pending.text); }
        void (async () => {
          if (!commentsLoaded) await loadComments();
          await post(pending.text, pending.type === 'commentReply' ? pending.commentId : undefined);
        })();
      }
    } catch {}
  }, [user, id]);

  if (loading) return <div className="page"><div className="module-loading"><LoadingIndicator label={t('lore.opening')}/></div></div>;
  if (error || !lore) return <div className="page"><Link href="/lores/" className="back-link"><ArrowLeft size={17}/>{t('lore.archive')}</Link><div className="lore-empty"><h2>{t('lore.notFound')}</h2><p>{error}</p></div></div>;
  const translation = lore.translations?.find(item => item.locale === locale);
  const title = translation?.title ?? lore.title;
  const body = translation?.text ?? lore.text;

  return <div className="page lore-reading-page">
    <Link href="/lores/" className="back-link"><ArrowLeft size={17}/>{t('lore.archive')}</Link>
    <article className="lore-reader">
      <header>
        <div className="lore-tags">{lore.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        <h1>{title}</h1>
        <p>{t('lore.minutes', { count: Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 220)) })}</p>
        {Boolean(lore.translations?.length) && <div className="lore-language"><Languages size={17}/><span>{t('lore.readIn')}</span><AppSelect value={locale} onChange={setLocale} ariaLabel={t('lore.readIn')} options={[{ value: 'original', label: t('lore.original'), icon: 'book' }, ...lore.translations!.map(item => ({ value: item.locale, label: item.label, icon: languageFlag(item.locale) }))]}/></div>}
      </header>
      {lore.imageUrls?.length > 0 && <div className={`lore-reader-gallery ${lore.imageUrls.length === 1 ? 'single' : ''}`}>{lore.imageUrls.map((url, index) => <img src={url} alt="" key={`${url}-${index}`} loading="lazy" />)}</div>}
      <div className="lore-prose">{body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      <footer className="lore-reader-actions">
        <button className={`vote-button up ${lore.userVote === 1 ? 'selected' : ''}`} onClick={() => void vote(1)}><ArrowBigUp/><span>{t('lore.upvote')}</span><b>{lore.upvotes}</b></button>
        <button className={`vote-button down ${lore.userVote === -1 ? 'selected' : ''}`} onClick={() => void vote(-1)}><ArrowBigDown/><span>{t('lore.downvote')}</span><b>{lore.downvotes}</b></button>
        <button className={`comments-button ${commentsOpen ? 'selected' : ''}`} onClick={() => void openComments()}><MessageCircle/><span>{t('lore.comments')}</span><b>{lore.commentCount}</b></button>
      </footer>
      {commentsOpen && <section className="comments lore-reader-comments">
        <form className="comment-compose" onSubmit={(event: FormEvent) => { event.preventDefault(); void post(text); }}>
          <textarea value={text} onChange={event => setText(event.target.value)} maxLength={1000} placeholder={t('lore.commentPlaceholder')}/>
          <button aria-label={t('lore.postComment')} disabled={!text.trim()}><Send size={16}/></button>
        </form>
        {commentsActionError && <p className="comment-action-error" role="alert">{commentsActionError}</p>}
        {commentsLoading ? <div className="comments-loading"><LoadingIndicator label={t('common.loading')} compact/></div> : commentsError ? <p role="alert">{commentsError}</p> : <CommentThreadList
          comments={comments}
          currentUserId={user?.id}
          replyingTo={replyingTo}
          replyText={replyText}
          onVote={(commentId, value) => void voteComment(commentId, value)}
          onReplyStart={commentId => { setReplyingTo(commentId); setReplyText(''); }}
          onReplyTextChange={setReplyText}
          onReplyCancel={() => { setReplyingTo(null); setReplyText(''); }}
          onReplySubmit={commentId => void post(replyText, commentId)}
        />}
      </section>}
    </article>
    {loginOpen && <div className="auth-popup" role="dialog" aria-modal="true"><div><button className="icon-button" onClick={() => setLoginOpen(false)} aria-label="Close"><X size={17}/></button><h2>{t('lore.loginTitle')}</h2><p>{t('lore.loginHint')}</p><button className="button dark" onClick={() => void signInWithGoogle(`${window.location.pathname}${window.location.search}`)}><LogIn size={17}/>{t('profile.googleSignIn')}</button></div></div>}
  </div>;
}
