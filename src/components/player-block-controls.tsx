'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban } from 'lucide-react';
import { memberApi } from '@/lib/member-api';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { FriendsDialog } from './friends-dialog';
import { LoadingIndicator } from './loading-indicator';

function changed() {
  window.dispatchEvent(new Event('ambatu:blocks-changed'));
  window.dispatchEvent(new Event('ambatu:friends-changed'));
}

export function PlayerBlockButton({
  playerId,
  name,
  onBlocked,
  onOpen,
}: {
  playerId: string;
  name: string;
  onBlocked: () => void;
  onOpen?: () => void;
}) {
  const { user, getIdToken } = useAuth();
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  if (!user || playerId === user.id) return null;
  async function block() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      await memberApi(
        `/blocks/${encodeURIComponent(playerId)}`,
        await getIdToken(),
        undefined,
        undefined,
        'PUT',
      );
      changed();
      setConfirming(false);
      onBlocked();
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="button secondary compact"
        onClick={() => {
          setError(false);
          setConfirming(true);
          onOpen?.();
        }}
      >
        <Ban size={16} />
        {t('blocks.block')}
      </button>
      {confirming && (
        <FriendsDialog
          title={t('blocks.confirmTitle')}
          busy={busy}
          onClose={() => {
            if (!busy) setConfirming(false);
          }}
        >
          <p>{t('blocks.confirmDescription', { name })}</p>
          {error && <p role="alert">{t('social.error')}</p>}
          <button
            type="button"
            className="button dark"
            disabled={busy}
            onClick={() => void block()}
          >
            {t('blocks.block')}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            {t('profile.avatarCancel')}
          </button>
        </FriendsDialog>
      )}
    </>
  );
}

type BlockedPlayer = { id: string; username?: string; avatarUrl?: string | null };
export function BlockedPlayersDialog({ onClose }: { onClose: () => void }) {
  const { user, getIdToken } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<BlockedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState('');
  const [version, setVersion] = useState(0);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const load = useRef<() => void>(() => {});
  const pendingUnblock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null,
      pending = false,
      done = false;
    // Reset the subscription when the account or unblock generation changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    const next = async () => {
      if (pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError(false);
      try {
        const page = await memberApi<{ items: BlockedPlayer[]; nextCursor: string | null }>(
          `/blocks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
          await getIdToken(),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setItems((previous) => [
          ...new Map([...previous, ...page.items].map((item) => [item.id, item])).values(),
        ]);
        cursor = page.nextCursor;
        done = !cursor;
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
  }, [getIdToken, user?.id, version]);
  useEffect(() => {
    if (!root || !sentinel || loading || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load.current();
      },
      { root, rootMargin: '160px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [root, sentinel, loading, error, items.length]);
  const unblock = useCallback(
    async (id: string) => {
      if (pendingUnblock.current) return;
      pendingUnblock.current = true;
      setBusy(id);
      try {
        await memberApi(
          `/blocks/${encodeURIComponent(id)}`,
          await getIdToken(),
          undefined,
          undefined,
          'DELETE',
        );
        changed();
        setVersion((value) => value + 1);
      } catch {
        setError(true);
      } finally {
        pendingUnblock.current = false;
        setBusy('');
      }
    },
    [getIdToken],
  );
  return (
    <FriendsDialog title={t('blocks.manage')} onClose={onClose} busy={Boolean(busy)}>
      <p>{t('blocks.unblockHint')}</p>
      <div className="blocked-player-list" ref={setRoot}>
        {items.map((item) => (
          <article className="friend-card" key={item.id}>
            <strong>{item.username || t('blocks.blockedThug')}</strong>
            <button
              className="button secondary compact"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void unblock(item.id)}
            >
              {t('blocks.unblock')}
            </button>
          </article>
        ))}
        {!loading && !error && !items.length && <p>{t('blocks.empty')}</p>}
        {loading && <LoadingIndicator label={t('common.loading')} />}
        {error && (
          <div role="alert">
            <p>{t('social.error')}</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setError(false);
                load.current();
              }}
            >
              {t('social.retry')}
            </button>
          </div>
        )}
        <div ref={setSentinel} className="friends-sentinel" />
      </div>
    </FriendsDialog>
  );
}
