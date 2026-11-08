'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  Globe2,
  LockKeyhole,
  Newspaper,
  Pencil,
  Send,
  Trash2,
  UsersRound,
} from 'lucide-react';
import {
  dreamApi,
  DreamApiError,
  dreamErrorKey,
  dreamHref,
  dreamRequestKey,
  type Dream,
  type DreamAudience,
} from '@/lib/ambatupost';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { FriendsDialog } from './friends-dialog';
import { LoadingIndicator } from './loading-indicator';
import { DreamActions } from './dream-actions';
import {
  DreamAttachments,
  DreamMedia,
  DreamCleanup,
  type DraftAttachment,
} from './dream-attachments';
import './ambatupost.css';

const audienceKeys = { public: 'post.public', friends: 'post.friends', only_me: 'post.onlyMe' };
const audienceHints = {
  public: 'post.publicHint',
  friends: 'post.friendsHint',
  only_me: 'post.onlyMeHint',
};
const audienceIcons = { public: Globe2, friends: UsersRound, only_me: LockKeyhole };

function DreamAudienceLabel({ audience }: { audience: DreamAudience }) {
  const { t } = useI18n();
  const Icon = audienceIcons[audience];
  return (
    <span className="dream-audience">
      <Icon size={14} aria-hidden="true" />
      {t(audienceKeys[audience])}
    </span>
  );
}

function MyDreams({
  getToken,
  version,
}: {
  getToken: () => Promise<string | null>;
  version: number;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ended, setEnded] = useState(false);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const load = useRef<() => void>(() => {});
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null,
      pending = false,
      done = false;
    // Reset the account's subscription when a Dream is saved or removed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    setEnded(false);
    const next = async () => {
      if (pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError('');
      try {
        const page = await dreamApi<{ dreams: Dream[]; nextCursor: string | null }>(
          `/mine${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
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
      } catch (reason) {
        if (!controller.signal.aborted) setError(dreamErrorKey(reason));
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
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
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, loading, error, ended, items.length]);
  return (
    <section className="dream-history" aria-labelledby="my-dreams-title">
      <header className="dream-section-heading">
        <h2 id="my-dreams-title">{t('post.myDreams')}</h2>
      </header>
      <div className="dream-history-list" aria-busy={loading}>
        {items.map((dream) => (
          <Link
            className="dream-history-card"
            key={dream.id}
            href={dreamHref(dream.id)}
            aria-label={`${t('post.read')}: ${dream.text.slice(0, 100) || t('post.mediaOnly', { count: dream.attachments?.length ?? 0 })}`}
          >
            <div className="dream-history-meta">
              <DreamAudienceLabel audience={dream.audience} />
              {dream.publication === 'draft' && (
                <span className="dream-draft">{t('post.draft')}</span>
              )}
              {dream.publication === 'processing' && (
                <span className="dream-draft">{t('post.processing')}</span>
              )}
              {dream.publication === 'failed' && (
                <span className="dream-draft">{t('post.failed')}</span>
              )}
              <ArrowUpRight size={18} aria-hidden="true" />
            </div>
            <p>{dream.text || t('post.mediaOnly', { count: dream.attachments?.length ?? 0 })}</p>
          </Link>
        ))}
      </div>
      {!loading && !error && !items.length && <p className="dream-empty">{t('post.empty')}</p>}
      {loading && <LoadingIndicator label={t('common.loading')} compact />}
      {error && (
        <div className="dream-notice" role="alert">
          <p>{t(error)}</p>
          <button className="button secondary compact" type="button" onClick={() => load.current()}>
            {t('common.retry')}
          </button>
        </div>
      )}
      <div ref={setSentinel} className="dream-sentinel" />
    </section>
  );
}

export function Ambatupost({
  dreamId,
  cleanupId,
}: {
  dreamId: string | null;
  cleanupId?: string | null;
}) {
  const { user, getIdToken, configured, signInWithGoogle } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const formId = useId();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dream, setDream] = useState<Dream | null>(null);
  const [editing, setEditing] = useState(!dreamId);
  const [text, setText] = useState('');
  const [audience, setAudience] = useState<DreamAudience>('public');
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(false);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [version, setVersion] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const idempotency = useRef<{ body: string; key: string } | null>(null);
  const committedAttachments = useRef(new Set<string>());
  const userId = user?.id;
  const getToken = useCallback(async () => {
    const token = await getIdToken();
    if (userId && !token) throw new DreamApiError('UNAUTHORIZED', 401);
    return token;
  }, [getIdToken, userId]);
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    // This subscription is scoped by account and direct-link identity.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    setDream(null);
    setAvailable(false);
    void (async () => {
      try {
        const token = await getToken();
        const config = await dreamApi<{ attachmentsEnabled: boolean }>('/config', token, {
          signal: request.signal,
        });
        if (request.signal.aborted) return;
        setAvailable(true);
        setAttachmentsEnabled(config.attachmentsEnabled);
        if (dreamId) {
          const item = await dreamApi<Dream>(`/${encodeURIComponent(dreamId)}`, token, {
            signal: request.signal,
          });
          if (request.signal.aborted) return;
          setDream(item);
          setText(item.text);
          setAudience(item.audience);
          setAttachments(item.attachments ?? []);
          setEditing(false);
        }
      } catch (reason) {
        if (!request.signal.aborted) setError(dreamErrorKey(reason));
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    })();
    return () => request.abort();
  }, [dreamId, getToken, version]);
  const processing =
    dream?.publication === 'processing' ||
    dream?.attachments?.some((item) => ['awaiting_upload', 'processing'].includes(item.state));
  useEffect(() => {
    if (!dreamId || !processing || editing) return;
    const request = new AbortController();
    let pending = false;
    const timer = window.setInterval(() => {
      if (pending) return;
      pending = true;
      void getToken()
        .then((token) => dreamApi<Dream>(`/${dreamId}`, token, { signal: request.signal }))
        .then((item) => {
          if (!request.signal.aborted) {
            setDream(item);
            setText(item.text);
            setAudience(item.audience);
            setAttachments(item.attachments ?? []);
          }
        })
        .catch((reason) => {
          if (!request.signal.aborted) setError(dreamErrorKey(reason));
        })
        .finally(() => {
          pending = false;
        });
    }, 4000);
    return () => {
      request.abort();
      window.clearInterval(timer);
    };
  }, [dreamId, processing, editing, getToken]);
  const own = Boolean(user && dream?.authorId === user.id);
  const count = Array.from(text).length;
  const valid =
    (Boolean(text.trim()) || attachments.length > 0) &&
    count <= 2000 &&
    attachments.every((item) => Boolean(item.id) && item.uploaded !== false);
  async function signIn() {
    try {
      await signInWithGoogle(`${window.location.pathname}${window.location.search}`);
    } catch {
      setError('post.error');
    }
  }
  async function save(publish: boolean) {
    if (pending.current || !valid || !user) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const request = controller.current;
    try {
      const payload = {
        text,
        audience,
        publish,
        attachmentIds: attachments.map((item) => item.id),
        ...(dream ? { revision: dream.revision } : {}),
      };
      const body = JSON.stringify(payload);
      if (!idempotency.current || idempotency.current.body !== body)
        idempotency.current = { body, key: dreamRequestKey() };
      const item = await dreamApi<Dream>(dream ? `/${dream.id}` : '', await getToken(), {
        method: dream ? 'PATCH' : 'POST',
        body: payload,
        key: dream ? undefined : idempotency.current.key,
        signal: request?.signal,
      });
      if (request?.signal.aborted) return;
      committedAttachments.current.clear();
      for (const attachment of item.attachments ?? [])
        committedAttachments.current.add(attachment.id);
      idempotency.current = null;
      if (!dream) router.push(dreamHref(item.id));
      else {
        setDream(item);
        setEditing(false);
      }
    } catch (reason) {
      if (!request?.signal.aborted) setError(dreamErrorKey(reason));
    } finally {
      pending.current = false;
      if (!request?.signal.aborted) setBusy(false);
    }
  }
  async function remove() {
    if (pending.current || !dream || !own) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const request = controller.current;
    try {
      const result = await dreamApi<{ operationId: string } | undefined>(
        `/${dream.id}`,
        await getToken(),
        {
          method: 'DELETE',
          signal: request?.signal,
        },
      );
      if (!request?.signal.aborted)
        router.replace(
          result?.operationId
            ? `/ambatupost/?cleanup=${encodeURIComponent(result.operationId)}`
            : '/ambatupost/',
        );
    } catch (reason) {
      if (!request?.signal.aborted) setError(dreamErrorKey(reason));
    } finally {
      pending.current = false;
      if (!request?.signal.aborted) {
        setBusy(false);
        setConfirming(false);
      }
    }
  }
  function edit() {
    if (!dream) return;
    setText(dream.text);
    setAudience(dream.audience);
    setAttachments(dream.attachments ?? []);
    setError('');
    setEditing(true);
  }
  return (
    <section className="page dream-page">
      <header className="dream-hero">
        <h1>
          {t('post.title')}
          <span className="orange-text">.</span>
        </h1>
        <span className="dream-hero-mark" aria-hidden="true">
          <Newspaper size={34} />
        </span>
      </header>
      {cleanupId && user && (
        <DreamCleanup key={cleanupId} operationId={cleanupId} getToken={getToken} />
      )}
      {dreamId && (
        <Link className="dream-back" href="/ambatupost/">
          <ArrowLeft size={17} />
          {t('post.back')}
        </Link>
      )}
      {loading && <LoadingIndicator label={t('common.loading')} />}
      {error && (
        <div className="dream-notice" role="alert">
          <p>{t(error)}</p>
          {error === 'post.conflict' && (
            <button
              type="button"
              className="button secondary compact"
              onClick={() => setVersion((value) => value + 1)}
            >
              {t('post.reload')}
            </button>
          )}
          {error === 'post.error' && !editing && (
            <button
              type="button"
              className="button secondary compact"
              onClick={() => setVersion((value) => value + 1)}
            >
              {t('common.retry')}
            </button>
          )}
          {error === 'post.signInAgain' && (
            <button type="button" className="button dark" onClick={() => void signIn()}>
              {t('profile.googleSignIn')}
            </button>
          )}
        </div>
      )}
      {!loading && available && (!dreamId || dream) && (
        <div className="dream-layout">
          <div className="dream-main">
            {dream && !editing && (
              <article className="dream-detail">
                <header className="dream-detail-header">
                  <span className="dream-author-mark" aria-hidden="true">
                    {(dream.authorName || t('post.dreamer')).slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{dream.authorName || t('post.dreamer')}</strong>
                    <p>
                      <time dateTime={dream.createdAt}>
                        {t('post.created', {
                          date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                            new Date(dream.createdAt),
                          ),
                        })}
                      </time>
                    </p>
                  </div>
                </header>
                <div className="dream-detail-meta">
                  <DreamAudienceLabel audience={dream.audience} />
                  {dream.publication === 'draft' && (
                    <span className="dream-draft">{t('post.draft')}</span>
                  )}
                </div>
                {dream.text && <p className="dream-text">{dream.text}</p>}
                {Boolean(dream.attachments?.length) && (
                  <DreamMedia
                    dreamId={dream.id}
                    revision={dream.revision}
                    attachments={dream.attachments!}
                    getToken={getToken}
                  />
                )}
                {own && (dream.publication === 'processing' || dream.hasPublishedVersion) && (
                  <p className="dream-helper" role="status">
                    {t(dream.hasPublishedVersion ? 'post.processingEdit' : 'post.processingDream')}
                  </p>
                )}
                {own && dream.publication === 'failed' && (
                  <div className="dream-notice" role="alert">
                    <p>{t('post.failedDream')}</p>
                    {dream.attachments
                      ?.filter(
                        (item) => item.state === 'failed' && item.error === 'PROCESSING_FAILED',
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          className="button secondary compact"
                          type="button"
                          onClick={() => {
                            void getToken()
                              .then((token) =>
                                dreamApi(`/uploads/${item.id}`, token, { method: 'POST' }),
                              )
                              .then(() => setVersion((value) => value + 1))
                              .catch((reason) => setError(dreamErrorKey(reason)));
                          }}
                        >
                          {t('post.retryAttachment')}
                        </button>
                      ))}
                  </div>
                )}
                {dream.publication === 'draft' && (
                  <p className="dream-helper">{t('post.draftHelp')}</p>
                )}
                {(dream.publication === 'published' || dream.hasPublishedVersion) && (
                  <DreamActions
                    key={`${dream.id}:${dream.updatedAt}`}
                    dream={dream}
                    getToken={getToken}
                    onUnavailable={() => { setDream(null); setError('post.unavailable'); }}
                  />
                )}
                {own && (
                  <footer className="dream-detail-actions">
                    <button type="button" className="button secondary compact" onClick={edit}>
                      <Pencil size={16} />
                      {t('post.edit')}
                    </button>
                    <button
                      type="button"
                      className="button secondary compact"
                      onClick={() => setConfirming(true)}
                    >
                      <Trash2 size={16} />
                      {t('post.delete')}
                    </button>
                  </footer>
                )}
              </article>
            )}
            {editing && user && (
              <form
                className="dream-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save(true);
                }}
                aria-busy={busy}
              >
                <header className="dream-section-heading">
                  <h2>{t(dream ? 'post.edit' : 'post.create')}</h2>
                </header>
                <label className="sr-only" htmlFor={`${formId}-text`}>
                  {t('post.body')}
                </label>
                <textarea
                  id={`${formId}-text`}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={t('post.placeholder')}
                  disabled={busy}
                  aria-describedby={`${formId}-count`}
                  aria-invalid={count > 2000}
                />
                <p
                  id={`${formId}-count`}
                  className={`dream-character-count${count > 2000 ? ' is-invalid' : ''}`}
                  aria-live="polite"
                >
                  {t('post.characters', { count, limit: 2000 })}
                </p>
                {attachmentsEnabled && (
                  <DreamAttachments
                    items={attachments}
                    setItems={setAttachments}
                    getToken={getToken}
                    disabled={busy}
                    committed={committedAttachments}
                  />
                )}
                <label htmlFor={`${formId}-audience`}>{t('post.audience')}</label>
                <select
                  id={`${formId}-audience`}
                  value={audience}
                  onChange={(event) => setAudience(event.target.value as DreamAudience)}
                  disabled={busy}
                  aria-describedby={`${formId}-audience-hint`}
                >
                  {(['public', 'friends', 'only_me'] as const).map((value) => (
                    <option value={value} key={value}>
                      {t(audienceKeys[value])}
                    </option>
                  ))}
                </select>
                <p id={`${formId}-audience-hint`} className="dream-helper">
                  {t(audienceHints[audience])}
                </p>
                <footer className="dream-composer-actions">
                  <button type="submit" className="button dark" disabled={busy || !valid}>
                    {busy ? (
                      <LoadingIndicator label={t('common.loading')} compact />
                    ) : (
                      <Send size={17} />
                    )}
                    {t(dream?.publication === 'published' ? 'post.saveChanges' : 'post.publish')}
                  </button>
                  {dream?.publication !== 'published' && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy || !valid}
                      onClick={() => void save(false)}
                    >
                      <Eye size={17} />
                      {t('post.saveDraft')}
                    </button>
                  )}
                  {dream && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => {
                        setEditing(false);
                        setError('');
                      }}
                    >
                      {t('post.cancel')}
                    </button>
                  )}
                </footer>
              </form>
            )}
            {!user && (
              <section className="dream-signin">
                <Newspaper size={26} aria-hidden="true" />
                <h2>{t('post.create')}</h2>
                <p>{t('post.signIn')}</p>
                <button
                  className="button dark"
                  type="button"
                  disabled={!configured}
                  onClick={() => void signIn()}
                >
                  {t('profile.googleSignIn')}
                </button>
              </section>
            )}
          </div>
          {user && <MyDreams getToken={getToken} version={dream?.revision ?? 0} />}
        </div>
      )}
      {confirming && (
        <FriendsDialog
          title={t('post.deleteTitle')}
          description={t('post.deleteDescription')}
          onClose={() => {
            if (!busy) setConfirming(false);
          }}
          busy={busy}
        >
          <button
            className="button dark"
            type="button"
            disabled={busy}
            onClick={() => void remove()}
          >
            {t('post.delete')}
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            {t('post.cancel')}
          </button>
        </FriendsDialog>
      )}
    </section>
  );
}
