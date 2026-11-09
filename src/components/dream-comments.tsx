'use client';

import Link from 'next/link';
import { RefreshCw, Send } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import {
  dreamApi,
  DreamApiError,
  dreamErrorKey,
  dreamRequestKey,
  type DreamComment,
} from '@/lib/ambatupost';
import { creatorHref } from '@/lib/creator-profile';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { DreamAvatar } from './dream-avatar';
import { DreamOwnerMenu } from './dream-owner-menu';
import { DreamCommentVotes } from './dream-comment-votes';
import { FriendsDialog } from './friends-dialog';
import { LoadingIndicator } from './loading-indicator';
import './dream-comments.css';

type Shared = {
  dreamId: string;
  getToken: () => Promise<string | null>;
  onUnavailable: () => void;
  onSignIn: () => void;
};
const dreamGone = (reason: unknown) =>
  reason instanceof DreamApiError &&
  ['DREAM_UNAVAILABLE', 'MODULE_UNAVAILABLE'].includes(reason.code);

function CommentScaffold() {
  const { t } = useI18n();
  return (
    <div className="dream-comment-scaffold" role="status">
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden="true">
        <span className="dream-skeleton-shape dream-skeleton-avatar" />
        <div>
          <span className="dream-skeleton-shape dream-skeleton-name" />
          <span className="dream-skeleton-shape dream-skeleton-line" />
          <span className="dream-skeleton-shape dream-skeleton-line short" />
        </div>
      </div>
    </div>
  );
}

function CommentComposer({
  dreamId,
  getToken,
  onUnavailable,
  onSignIn,
  parentId = null,
  editing,
  onSaved,
  onCancel,
  onReload,
  inputRef,
}: Shared & {
  parentId?: string | null;
  editing?: DreamComment;
  onSaved: (comment: DreamComment) => void;
  onCancel?: () => void;
  onReload: () => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const { t } = useI18n();
  const id = useId();
  const localInput = useRef<HTMLTextAreaElement>(null);
  const textarea = inputRef ?? localInput;
  const [text, setText] = useState(editing?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const intent = useRef<{ body: string; key: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    if (editing || parentId) textarea.current?.focus();
    return () => controller.abort();
  }, [editing, parentId, textarea]);
  const count = Array.from(text).length;
  async function save() {
    if (pending.current || !text.trim() || count > 2000) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const controller = request.current;
    const body = editing ? { text, revision: editing.revision } : { text, parentId };
    const encoded = JSON.stringify(body);
    if (intent.current?.body !== encoded)
      intent.current = { body: encoded, key: dreamRequestKey() };
    try {
      const result = await dreamApi<DreamComment>(
        `/${dreamId}/comments${editing ? `/${editing.id}` : ''}`,
        await getToken(),
        {
          method: editing ? 'PATCH' : 'POST',
          body,
          key: editing ? undefined : intent.current.key,
          signal: controller?.signal,
        },
      );
      if (controller?.signal.aborted) return;
      if (!editing) setText('');
      intent.current = null;
      onSaved(result);
    } catch (reason) {
      if (controller?.signal.aborted) return;
      if (dreamGone(reason)) onUnavailable();
      else setError(dreamErrorKey(reason));
    } finally {
      pending.current = false;
      if (!controller?.signal.aborted) setBusy(false);
    }
  }
  return (
    <form
      className="dream-comment-composer"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label className="sr-only" htmlFor={id}>
        {t(parentId ? 'post.replyBody' : 'post.commentBody')}
      </label>
      <textarea
        ref={textarea}
        id={id}
        rows={2}
        value={text}
        disabled={busy}
        placeholder={t(parentId ? 'post.replyPlaceholder' : 'post.commentPlaceholder')}
        aria-describedby={`${id}-count`}
        aria-invalid={count > 2000}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="dream-comment-composer-actions">
        <span id={`${id}-count`} className={count > 2000 ? 'is-invalid' : ''}>
          {t('post.characters', { count, limit: 2000 })}
        </span>
        <button
          type="button"
          className="dream-comment-refresh"
          aria-label={t('post.refreshComments')}
          disabled={busy}
          onClick={onReload}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
        {onCancel && (
          <button
            type="button"
            className="dream-comment-text-button"
            disabled={busy}
            onClick={onCancel}
          >
            {t('post.cancel')}
          </button>
        )}
        <button
          type="submit"
          className="dream-comment-submit"
          disabled={busy || !text.trim() || count > 2000}
          aria-label={t(
            editing ? 'post.saveComment' : parentId ? 'post.replySend' : 'post.commentSend',
          )}
        >
          {busy ? (
            <LoadingIndicator label={t('common.loading')} compact />
          ) : (
            <Send size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <div className="dream-comment-error" role="alert">
          <p>{t(error)}</p>
          {error === 'post.signInAgain' && (
            <button type="button" className="dream-comment-text-button" onClick={onSignIn}>
              {t('profile.googleSignIn')}
            </button>
          )}
          {['post.commentConflict', 'post.commentUnavailable'].includes(error) && (
            <button type="button" className="dream-comment-text-button" onClick={onReload}>
              {t('post.refreshComments')}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function CommentItem({
  item,
  onChanged,
  onReload,
  onReply,
  ...shared
}: Shared & {
  item: DreamComment;
  onChanged: (item: DreamComment) => void;
  onReload: () => void;
  onReply: () => void;
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const repliesId = useId();
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    return () => controller.abort();
  }, []);
  async function remove() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const controller = request.current;
    try {
      const result = await dreamApi<DreamComment>(
        `/${shared.dreamId}/comments/${item.id}`,
        await shared.getToken(),
        { method: 'DELETE', signal: controller?.signal },
      );
      if (!controller?.signal.aborted) {
        onChanged(result);
        setConfirming(false);
      }
    } catch (reason) {
      if (controller?.signal.aborted) return;
      if (dreamGone(reason)) shared.onUnavailable();
      else if (reason instanceof DreamApiError && reason.code === 'COMMENT_UNAVAILABLE') {
        setConfirming(false);
        onReload();
      } else setError(dreamErrorKey(reason));
    } finally {
      pending.current = false;
      if (!controller?.signal.aborted) setBusy(false);
    }
  }
  return (
    <article
      className="dream-comment"
      data-comment-id={item.id}
      data-reply={Boolean(item.parentId)}
    >
      {item.deleted ? (
        <p className="dream-comment-deleted">{t('post.commentDeleted')}</p>
      ) : (
        <>
          <header className="dream-comment-header">
            <Link
              href={`${creatorHref(item.authorId!)}&from=post`}
              prefetch={false}
              aria-label={t('creator.view', { name: item.authorName || t('post.dreamer') })}
            >
              <DreamAvatar name={item.authorName ?? ''} src={item.authorAvatarUrl} />
            </Link>
            <div>
              <Link href={`${creatorHref(item.authorId!)}&from=post`} prefetch={false}>
                <strong>{item.authorName || t('post.dreamer')}</strong>
              </Link>
              <time dateTime={item.createdAt}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(item.createdAt))}
              </time>
              {item.createdAt !== item.updatedAt && (
                <span className="dream-comment-edited">{t('post.commentEdited')}</span>
              )}
            </div>
            {user?.id === item.authorId && (
              <DreamOwnerMenu
                editLabelKey="post.editComment"
                deleteLabelKey="post.deleteComment"
                onEdit={() => setEditing(true)}
                onDelete={() => setConfirming(true)}
              />
            )}
          </header>
          {editing ? (
            <CommentComposer
              {...shared}
              editing={item}
              parentId={item.parentId}
              onSaved={(value) => {
                onChanged(value);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
              onReload={onReload}
            />
          ) : (
            <p className="dream-comment-body">{item.text}</p>
          )}
          <DreamCommentVotes
            key={`${item.id}:${item.revision}`}
            initial={item.votes}
            path={`/${shared.dreamId}/comments/${item.id}/vote`}
            getToken={shared.getToken}
            onSignIn={shared.onSignIn}
            onFailure={(reason) => {
              if (dreamGone(reason)) shared.onUnavailable();
              else if (reason instanceof DreamApiError && reason.code === 'COMMENT_UNAVAILABLE')
                onReload();
            }}
          />
        </>
      )}
      {!item.parentId ? (
        <>
          <button
            type="button"
            className="dream-comment-text-button"
            aria-expanded={expanded}
            aria-controls={repliesId}
            onClick={() => setExpanded((value) => !value)}
          >
            {t(
              expanded ? 'post.hideReplies' : user && !item.deleted ? 'post.reply' : 'post.replies',
            )}
          </button>
          {expanded && (
            <div className="dream-comment-replies" id={repliesId}>
              <CommentThread {...shared} parentId={item.id} />
            </div>
          )}
        </>
      ) : !item.deleted ? (
        <button
          type="button"
          className="dream-comment-text-button"
          onClick={() => (user ? onReply() : shared.onSignIn())}
        >
          {t('post.reply')}
        </button>
      ) : null}
      {confirming && (
        <FriendsDialog
          title={t('post.deleteCommentConfirm')}
          description={t('post.deleteCommentHint')}
          busy={busy}
          onClose={() => setConfirming(false)}
        >
          {error && (
            <p className="friends-error" role="alert">
              {t(error)}
            </p>
          )}
          <button
            type="button"
            className="button dark"
            disabled={busy}
            onClick={() => void remove()}
          >
            {t('post.deleteComment')}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            {t('post.cancel')}
          </button>
        </FriendsDialog>
      )}
    </article>
  );
}

function CommentThread({ parentId = null, ...shared }: Shared & { parentId?: string | null }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState<DreamComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const load = useRef<() => void>(() => {});
  const textarea = useRef<HTMLTextAreaElement>(null);
  const callbacks = useRef(shared);
  useEffect(() => {
    callbacks.current = shared;
  });
  const { dreamId } = shared;
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null,
      pending = false,
      done = false,
      emptyUntil = 0;
    // A new account/thread/refresh aborts the old cursor subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    setError('');
    setEnded(false);
    setLoading(true);
    async function next() {
      if (pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError('');
      try {
        const delay = emptyUntil - Date.now();
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        if (controller.signal.aborted) return;
        const query = new URLSearchParams();
        if (parentId) query.set('parent', parentId);
        if (cursor) query.set('cursor', cursor);
        const page = await dreamApi<{ comments: DreamComment[]; nextCursor: string | null }>(
          `/${dreamId}/comments?${query}`,
          await callbacks.current.getToken(),
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        cursor = page.nextCursor;
        done = !cursor;
        emptyUntil = page.comments.length ? 0 : Date.now() + 1000;
        setItems((previous) => [
          ...previous,
          ...page.comments.filter((item) => !previous.some((old) => old.id === item.id)),
        ]);
        setEnded(done);
      } catch (reason) {
        if (controller.signal.aborted) return;
        if (dreamGone(reason)) callbacks.current.onUnavailable();
        else setError(dreamErrorKey(reason));
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load.current = () => void next();
    void next();
    return () => controller.abort();
  }, [dreamId, parentId, version, user?.id]);
  useEffect(() => {
    if (!sentinel || loading || ended || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load.current();
      },
      { rootMargin: '180px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, loading, ended, error, items.length]);
  const reload = () => setVersion((value) => value + 1);
  return (
    <div className="dream-comment-thread">
      {user ? (
        <CommentComposer
          {...shared}
          parentId={parentId}
          inputRef={textarea}
          onReload={reload}
          onSaved={(value) =>
            setItems((previous) => [value, ...previous.filter((item) => item.id !== value.id)])
          }
        />
      ) : !parentId ? (
        <div className="dream-comment-guest-actions">
          <button type="button" className="dream-comment-signin" onClick={shared.onSignIn}>
            {t('post.commentSignIn')}
          </button>
          <button
            type="button"
            className="dream-comment-refresh"
            aria-label={t('post.refreshComments')}
            onClick={reload}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="dream-comment-list" aria-busy={loading}>
        {items.map((item) => (
          <CommentItem
            key={item.id}
            {...shared}
            item={item}
            onReload={reload}
            onReply={() => textarea.current?.focus()}
            onChanged={(value) =>
              setItems((previous) =>
                previous.flatMap((old) =>
                  old.id !== value.id
                    ? [old]
                    : value.deleted && (value.parentId || value.retained === false)
                      ? []
                      : [value],
                ),
              )
            }
          />
        ))}
      </div>
      {loading && <CommentScaffold />}
      {!loading && ended && !items.length && !error && (
        <p className="dream-helper">{t(parentId ? 'post.repliesEmpty' : 'post.commentsEmpty')}</p>
      )}
      {error && (
        <div className="dream-comment-error" role="alert">
          <p>{t(error)}</p>
          <button
            type="button"
            className="dream-comment-text-button"
            onClick={() => (error === 'post.signInAgain' ? shared.onSignIn() : load.current())}
          >
            {t(error === 'post.signInAgain' ? 'profile.googleSignIn' : 'common.retry')}
          </button>
        </div>
      )}
      <div className="dream-comment-sentinel" ref={setSentinel} />
    </div>
  );
}

export function DreamComments({ id, ...shared }: Omit<Shared, 'onSignIn'> & { id: string }) {
  const { t } = useI18n();
  const { user, configured, signInWithGoogle } = useAuth();
  const [signInPrompt, setSignInPrompt] = useState(false);
  const [error, setError] = useState('');
  return (
    <section id={id} className="dream-comments" aria-label={t('post.comments')}>
      <CommentThread key={user?.id ?? 'guest'} {...shared} onSignIn={() => setSignInPrompt(true)} />
      {signInPrompt && (
        <FriendsDialog title={t('post.commentSignIn')} onClose={() => setSignInPrompt(false)}>
          {error && (
            <p className="friends-error" role="alert">
              {t(error)}
            </p>
          )}
          <button
            type="button"
            className="button dark"
            disabled={!configured}
            onClick={() => {
              void signInWithGoogle(`${window.location.pathname}${window.location.search}`).catch(
                () => setError('post.error'),
              );
            }}
          >
            {t('profile.googleSignIn')}
          </button>
        </FriendsDialog>
      )}
    </section>
  );
}
