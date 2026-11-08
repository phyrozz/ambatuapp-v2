'use client';
import { useEffect, useRef, useState } from 'react';
import { dreamApi, dreamErrorKey, type Dream } from '@/lib/ambatupost';
import { useI18n } from './i18n-provider';
import { DreamFeedCard } from './dream-feed';
import { DreamSkeleton } from './dream-skeleton';
import './ambatupost.css';

export function MyDreams({
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
  const [deleted, setDeleted] = useState(false);
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
  useEffect(() => {
    if (!deleted) return;
    const timer = window.setTimeout(() => setDeleted(false), 5000);
    return () => window.clearTimeout(timer);
  }, [deleted]);
  return (
    <section className="dream-history" aria-labelledby="my-dreams-title">
      <header className="dream-section-heading">
        <h2 id="my-dreams-title">{t('creator.myDreamsHeading')}</h2>
      </header>
      {deleted && <p className="dream-notice" role="status">{t('post.deleted')}</p>}
      <div className="dream-history-list" aria-busy={loading}>
        {items.map((dream) => (
          <DreamFeedCard
            key={dream.id}
            dream={dream}
            getToken={getToken}
            ownerHistory
            onRemove={(id, removed) => {
              setItems((previous) => previous.filter((item) => item.id !== id));
              if (removed) setDeleted(true);
            }}
          />
        ))}
      </div>
      {!loading && !error && !items.length && <p className="dream-empty">{t('post.empty')}</p>}
      {loading && <DreamSkeleton variant="feed" />}
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
