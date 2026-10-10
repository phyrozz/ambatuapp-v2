'use client';
import Link from 'next/link';
import { ArrowBigUp, MessageCircle, Play, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { memberApi } from '@/lib/member-api';
import type { CreatorClip } from '@/lib/creator-profile';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import { VideoManageDialog } from './video-manage-dialog';
import './creator-profile.css';

function ClipCard({
  clip,
  creatorId,
  canManage,
  onManage,
}: {
  clip: CreatorClip;
  creatorId: string;
  canManage: boolean;
  onManage: () => void;
}) {
  const { t, locale } = useI18n();
  const [failed, setFailed] = useState(false);
  const date = clip.createdAt
    ? new Date(clip.createdAt).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
  const contents = (
    <>
      <div className="creator-clip-cover">
        {clip.thumbnailUrl && !failed ? (
          <img src={clip.thumbnailUrl} loading="lazy" alt="" onError={() => setFailed(true)} />
        ) : (
          <Video size={36} aria-hidden="true" />
        )}
        {clip.playable ? (
          <span className="creator-clip-play" aria-hidden="true">
            <Play size={22} fill="currentColor" />
          </span>
        ) : (
          <span className="creator-clip-status">
            {t(clip.status === 'Draft' ? 'creator.draft' : 'creator.unavailableClip')}
          </span>
        )}
      </div>
      <div className="creator-clip-copy">
        <h3>{clip.title}</h3>
        {clip.description && <p>{clip.description}</p>}
        <div className="creator-clip-meta">
          <span aria-label={`${t('lore.upvote')}: ${clip.upvotes}`}>
            <ArrowBigUp size={16} />
            {clip.upvotes}
          </span>
          <span aria-label={`${t('lore.comments')}: ${clip.commentCount}`}>
            <MessageCircle size={15} />
            {clip.commentCount}
          </span>
          {date && <time dateTime={clip.createdAt!}>{date}</time>}
        </div>
      </div>
    </>
  );
  return (
    <article className="creator-clip-card">
      {clip.playable ? (
        <Link
          className="creator-clip-link"
          href={`/scroll/?clip=${encodeURIComponent(clip.id)}&creator=${encodeURIComponent(creatorId)}`}
          aria-label={t('creator.playClip', { title: clip.title })}
        >
          {contents}
        </Link>
      ) : (
        <div className="creator-clip-content">{contents}</div>
      )}
      {canManage && (
        <button
          className="button secondary compact creator-clip-manage"
          type="button"
          onClick={onManage}
        >
          {t('watch.manageVideo')}
        </button>
      )}
    </article>
  );
}

export function CreatorClips({
  id,
  own,
  contained = false,
  active = true,
  onUpload,
}: {
  id: string;
  own: boolean;
  contained?: boolean;
  active?: boolean;
  onUpload?: () => void;
}) {
  const { t } = useI18n();
  const { getIdToken, user } = useAuth();
  const [clips, setClips] = useState<CreatorClip[]>([]);
  const [managingClip, setManagingClip] = useState<CreatorClip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const [version, setVersion] = useState(0);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const load = useRef<() => void>(() => {});
  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener('ambatu:clips-changed', refresh);
    return () => window.removeEventListener('ambatu:clips-changed', refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null,
      pending = false,
      done = false;
    // Each uploader owns a separate cursor sequence and initial batch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClips([]);
    setLoading(true);
    setError(false);
    setEnded(false);
    const next = async () => {
      if (pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError(false);
      try {
        const data = await memberApi<{ clips: CreatorClip[]; nextCursor: string | null }>(
          `/creators/${encodeURIComponent(id)}/clips${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
          await getIdToken(),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setClips((previous) => [
          ...new Map([...previous, ...data.clips].map((clip) => [clip.id, clip])).values(),
        ]);
        cursor = data.nextCursor;
        done = !cursor;
        setEnded(done);
      } catch {
        if (!controller.signal.aborted) setError(true);
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
  }, [id, own, getIdToken, version]);
  useEffect(() => {
    if (!active || !sentinel || loading || error || ended || (contained && !scrollRoot)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) load.current();
      },
      { root: contained ? scrollRoot : null, rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, clips, loading, error, ended, contained, scrollRoot, active]);
  return (
    <section className="creator-clips-section" aria-labelledby={`creator-clips-${id}`}>
      <header>
        <div>
          <p className="eyebrow">{t('nav.scroll')}</p>
          <h2 id={`creator-clips-${id}`}>{t(own ? 'creator.myClips' : 'creator.uploadedClips')}</h2>
        </div>
        {own &&
          (onUpload ? (
            <button className="button secondary compact" type="button" onClick={onUpload}>
              {t('watch.upload')}
            </button>
          ) : (
            <Link className="button secondary compact" href="/scroll/">
              {t('watch.upload')}
            </Link>
          ))}
      </header>
      <div
        className={contained ? 'creator-clips-scroll' : undefined}
        ref={contained ? setScrollRoot : undefined}
        tabIndex={contained ? 0 : undefined}
        role={contained ? 'region' : undefined}
        aria-label={contained ? t(own ? 'creator.myClips' : 'creator.uploadedClips') : undefined}
      >
        <div className="creator-clips-grid" aria-busy={loading}>
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              creatorId={id}
              canManage={own && user?.id === id}
              onManage={() => setManagingClip(clip)}
            />
          ))}
        </div>
        {ended && !clips.length && !loading && !error && (
          <div className="creator-empty">
            <Video size={34} aria-hidden="true" />
            <h3>{t('creator.emptyClips')}</h3>
            {own && <p>{t('creator.emptyOwnClips')}</p>}
          </div>
        )}
        {loading && <LoadingIndicator label={t('common.loading')} />}
        {error && (
          <div className="creator-error" role="alert">
            <p>{t('creator.clipsError')}</p>
            <button
              className="button secondary compact"
              type="button"
              onClick={() => load.current()}
            >
              {t('common.retry')}
            </button>
          </div>
        )}
        <div ref={setSentinel} className="creator-sentinel" />
      </div>
      {managingClip && (
        <VideoManageDialog
          video={managingClip}
          onClose={() => setManagingClip(null)}
          onSaved={(updated) => {
            setClips((previous) =>
              previous.map((clip) =>
                clip.id === managingClip.id ? { ...clip, ...updated } : clip,
              ),
            );
            setManagingClip(null);
            window.dispatchEvent(new Event('ambatu:clips-changed'));
          }}
          onDeleted={() => {
            setClips((previous) => previous.filter((clip) => clip.id !== managingClip.id));
            setManagingClip(null);
            window.dispatchEvent(new Event('ambatu:clips-changed'));
          }}
        />
      )}
    </section>
  );
}
