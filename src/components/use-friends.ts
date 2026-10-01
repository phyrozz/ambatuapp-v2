'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { memberApi } from '@/lib/member-api';
import { useAuth } from './auth-provider';

export type Friend = {
  id: string;
  username: string;
  avatarUrl: string | null;
  state: 'accepted' | 'incoming' | 'outgoing' | null;
  pinned?: boolean;
};
export type FriendPage = { friends: Friend[]; nextCursor: string | null };

export function useFriends({
  state,
  pinned = false,
  search = '',
  enabled = true,
  root = null,
}: {
  state?: NonNullable<Friend['state']>;
  pinned?: boolean;
  search?: string;
  enabled?: boolean;
  root?: HTMLDivElement | null;
} = {}) {
  const { user, getIdToken } = useAuth();
  const [items, setItems] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(enabled && !!user);
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const [version, setVersion] = useState(0);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const load = useRef<() => void>(() => {});
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null,
      pending = false,
      done = false;
    // Reset the subscription before requesting a different cursor-backed list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    setError(false);
    setEnded(false);
    setLoading(enabled && !!user);
    const next = async () => {
      if (!enabled || !user || pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams();
        if (state) params.set('state', state);
        if (pinned) params.set('pinned', 'true');
        if (search) params.set('q', search);
        if (cursor) params.set('cursor', cursor);
        const token = await getIdToken();
        if (controller.signal.aborted) return;
        const data = await memberApi<FriendPage>(
          `/friends${search ? '/search' : ''}?${params}`,
          token,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const visible = data.friends.filter(
          (item) =>
            (!state || item.state === state) &&
            (!pinned || (item.state === 'accepted' && item.pinned)),
        );
        setItems((previous) => [
          ...new Map([...previous, ...visible].map((item) => [item.id, item])).values(),
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
  }, [enabled, user, getIdToken, state, pinned, search, version]);
  useEffect(() => {
    if (!enabled || !sentinel || error || loading || ended) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) load.current();
      },
      { root, rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, items, error, loading, ended, root, sentinel]);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const retry = useCallback(() => load.current(), []);
  return { items, setItems, loading, error, ended, sentinel: setSentinel, refresh, retry };
}
