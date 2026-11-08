'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import { dreamApi, DreamApiError, dreamErrorKey, type Dream } from '@/lib/ambatupost';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { DreamActions } from './dream-actions';
import { DreamMedia } from './dream-attachments';
import { DreamAudienceLabel } from './dream-audience';
import { DreamAvatar } from './dream-avatar';
import { DreamOwnerMenu } from './dream-owner-menu';
import { DreamEditorDialog } from './dream-editor-dialog';
import { creatorHref } from '@/lib/creator-profile';
import { FriendsDialog } from './friends-dialog';
import { DreamSkeleton } from './dream-skeleton';
type Token = () => Promise<string | null>;

export function DreamFeedCard({
  dream: initialDream,
  getToken,
  onRemove,
  ownerHistory = false,
}: {
  dream: Dream;
  getToken: Token;
  onRemove: (id: string, deleted?: boolean) => void;
  ownerHistory?: boolean;
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [updatedDream, setUpdatedDream] = useState<Dream | null>(null);
  const dream = updatedDream ?? initialDream;
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const article = useRef<HTMLElement>(null);
  const deleting = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const observer = new IntersectionObserver(
      (entries) => setActive(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '400px' },
    );
    if (article.current) observer.observe(article.current);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, []);
  async function remove() {
    if (deleting.current) return;
    deleting.current = true;
    setBusy(true);
    setError('');
    try {
      await dreamApi(`/${dream.id}`, await getToken(), {
        method: 'DELETE',
        signal: request.current?.signal,
      });
      if (!request.current?.signal.aborted) onRemove(dream.id, true);
    } catch (reason) {
      if (!request.current?.signal.aborted) {
        if (reason instanceof DreamApiError && [404, 410].includes(reason.status))
          onRemove(dream.id);
        else setError(dreamErrorKey(reason));
      }
    } finally {
      deleting.current = false;
      if (!request.current?.signal.aborted) setBusy(false);
    }
  }
  return (
    <article ref={article} className="dream-detail dream-feed-card">
      <header className="dream-detail-header">
        <Link
          href={`${creatorHref(dream.authorId)}&from=post`}
          prefetch={false}
          aria-label={t('creator.view', { name: dream.authorName || t('post.dreamer') })}
        >
          <DreamAvatar
            name={dream.authorName || t('post.dreamer')}
            src={dream.authorAvatarUrl ?? null}
          />
        </Link>
        <div>
          <Link href={`${creatorHref(dream.authorId)}&from=post`} prefetch={false}>
            <strong>{dream.authorName || t('post.dreamer')}</strong>
          </Link>
          <p>
              <time dateTime={dream.publishedAt ?? dream.createdAt}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(dream.publishedAt ?? dream.createdAt))}
              </time>
          </p>
        </div>
        {dream.authorId === user?.id ? (
          <DreamOwnerMenu
            onEdit={() => setEditing(true)}
            onDelete={() => setConfirming(true)}
          />
        ) : null}
      </header>
      <div className="dream-detail-meta">
        <DreamAudienceLabel audience={dream.audience} />
        {ownerHistory && dream.publication !== 'published' && (
          <span className="dream-draft">
            {t(dream.publication === 'draft' ? 'post.draft' : dream.publication === 'failed' ? 'post.failed' : 'post.processing')}
          </span>
        )}
      </div>
      {dream.text && <p className="dream-text">{dream.text}</p>}
      {Boolean(dream.attachments?.length) && (
        <DreamMedia
          dreamId={dream.id}
          revision={dream.revision}
          attachments={dream.attachments!}
          getToken={getToken}
          active={active}
        />
      )}
      {ownerHistory && dream.publication === 'draft' && (
        <p className="dream-helper">{t('post.draftHelp')}</p>
      )}
      {ownerHistory && (dream.publication === 'processing' || dream.hasPublishedVersion) && (
        <p className="dream-helper" role="status">
          {t(dream.hasPublishedVersion ? 'post.processingEdit' : 'post.processingDream')}
        </p>
      )}
      {ownerHistory && dream.publication === 'failed' && !dream.hasPublishedVersion && (
        <p className="dream-helper" role="status">{t('post.failedDream')}</p>
      )}
      {(dream.publication === 'published' || dream.hasPublishedVersion) && (
        <DreamActions key={`${dream.id}:${dream.updatedAt}`} dream={dream} getToken={getToken} onUnavailable={() => onRemove(dream.id)} />
      )}
      {editing && (
        <DreamEditorDialog
          id={dream.id}
          onClose={() => setEditing(false)}
          onSaved={(item) => {
            setUpdatedDream(item);
            setEditing(false);
          }}
        />
      )}
      {confirming && (
        <FriendsDialog
          title={t('post.deleteTitle')}
          description={t('post.deleteDescription')}
          onClose={() => setConfirming(false)}
          busy={busy}
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
            {t('post.delete')}
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

export function DreamFeed({ getToken }: { getToken: Token }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ended, setEnded] = useState(false);
  const [version, setVersion] = useState(0);
  const [deleted, setDeleted] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const load = useRef<() => void>(() => {});
  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener('ambatu:dreams-changed', refresh);
    return () => window.removeEventListener('ambatu:dreams-changed', refresh);
  }, []);
  useEffect(() => {
    let start: { x: number; y: number; distance: number; engaged: boolean } | null = null;
    const reset = () => {
      start = null;
      setPullDistance(0);
    };
    const touchStart = (event: TouchEvent) => {
      if (!window.matchMedia('(max-width: 600px)').matches || window.scrollY > 0 || event.touches.length !== 1 || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], video, .dream-media-viewer, .dream-attachments-editor')) return;
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, distance: 0, engaged: false };
    };
    const touchMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dy = touch.clientY - start.y;
      const dx = touch.clientX - start.x;
      if (!start.engaged && (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0)) {
        reset();
        return;
      }
      if (dy > 4) {
        start.engaged = true;
        start.distance = dy;
        if (event.cancelable) event.preventDefault();
        setPullDistance(Math.max(0, Math.min(dy, 100)));
      }
    };
    const touchEnd = () => {
      if (start?.engaged && start.distance >= 70) {
        setRefreshing(true);
        setVersion((value) => value + 1);
      }
      reset();
    };
    document.addEventListener('touchstart', touchStart, { passive: true });
    document.addEventListener('touchmove', touchMove, { passive: false });
    document.addEventListener('touchend', touchEnd);
    document.addEventListener('touchcancel', reset);
    return () => {
      document.removeEventListener('touchstart', touchStart);
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchend', touchEnd);
      document.removeEventListener('touchcancel', reset);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null,
      pending = false,
      done = false,
      emptyUntil = 0;
    // A new subscription clears the previous window and aborts its pending page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    setEnded(false);
    setError('');
    setLoading(true);
    const next = async () => {
      if (pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError('');
      try {
        const wait = emptyUntil - Date.now();
        if (wait > 0)
          await new Promise<void>((resolve) => {
            const timer = window.setTimeout(resolve, wait);
            controller.signal.addEventListener(
              'abort',
              () => {
                window.clearTimeout(timer);
                resolve();
              },
              { once: true },
            );
          });
        if (controller.signal.aborted) return;
        const page = await dreamApi<{ dreams: Dream[]; nextCursor: string | null }>(
          `/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
          await getToken(),
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setItems((previous) => [
          ...new Map([...previous, ...page.dreams].map((item) => [item.id, item])).values(),
        ]);
        cursor = page.nextCursor;
        done = !cursor;
        setEnded(done);
        emptyUntil = page.dreams.length ? 0 : Date.now() + 1000;
      } catch (reason) {
        if (!controller.signal.aborted) {
          const expired =
            reason instanceof DreamApiError &&
            ['INVALID_FEED_CURSOR', 'FEED_CURSOR_EXPIRED'].includes(reason.code);
          setError(expired ? 'post.feedExpired' : dreamErrorKey(reason));
          if (reason instanceof DreamApiError && [401, 403].includes(reason.status)) setItems([]);
        }
      } finally {
        pending = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    load.current = () => {
      void next();
    };
    void next();
    return () => controller.abort();
  }, [getToken, version]);
  useEffect(() => {
    if (!sentinel || loading || error || ended) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load.current();
      },
      { rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, loading, error, ended, items.length]);
  useEffect(() => {
    let hidden = 0;
    const visible = () => {
      if (document.hidden) hidden = Date.now();
      else if (hidden && Date.now() - hidden > 30_000) {
        hidden = 0;
        setVersion((value) => value + 1);
      }
    };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, []);
  useEffect(() => {
    if (!deleted) return;
    const timer = window.setTimeout(() => setDeleted(false), 5000);
    return () => window.clearTimeout(timer);
  }, [deleted]);
  return (
    <section className="dream-feed" aria-labelledby="dreamies-title">
      <div
        className="dream-pull-indicator"
        data-visible={pullDistance > 4 || refreshing}
        data-dragging={pullDistance > 0}
        data-refreshing={refreshing}
        style={{
          '--pull-offset': `${refreshing ? 18 : Math.min(pullDistance * 0.45, 35) - 18}px`,
          '--pull-rotation': `${Math.min(pullDistance / 70, 1) * 270}deg`,
        } as CSSProperties}
        aria-hidden="true"
      >
          <RefreshCw size={18} />
      </div>
      <header className="dream-section-heading">
        <h2 id="dreamies-title" className="sr-only">{t('post.feed')}</h2>
        <button
          className="dream-refresh"
          type="button"
          aria-label={t('post.refreshFeed')}
          onClick={() => setVersion((value) => value + 1)}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </header>
      {deleted && (
        <p className="dream-notice" role="status">
          {t('post.deleted')}
        </p>
      )}
      <div className="dream-feed-list" aria-busy={loading}>
        {items.map((dream) => (
          <DreamFeedCard
            key={dream.id}
            dream={dream}
            getToken={getToken}
            onRemove={(id, removed) => {
              setItems((previous) => previous.filter((item) => item.id !== id));
              if (removed) {
                setDeleted(true);
              }
            }}
          />
        ))}
      </div>
      {loading && <DreamSkeleton variant="feed" />}
      {error && (
        <div className="dream-notice" role="alert">
          <p>{t(error)}</p>
          <button
            type="button"
            className="button secondary compact"
            onClick={() =>
              error === 'post.feedExpired' ? setVersion((value) => value + 1) : load.current()
            }
          >
            {t(error === 'post.feedExpired' ? 'post.refreshFeed' : 'common.retry')}
          </button>
        </div>
      )}
      {!loading && !error && ended && (
        <p className="dream-feed-end">{t(items.length ? 'post.feedEnd' : 'post.feedEmpty')}</p>
      )}
      <div ref={setSentinel} className="dream-sentinel" />
    </section>
  );
}
