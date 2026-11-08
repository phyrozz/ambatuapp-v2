'use client';
import { useCallback, useEffect, useState } from 'react';
import { creatorRead } from '@/lib/creator-profile';
import type { CreatorProfile } from '@/lib/creator-profile';
import { useAuth } from './auth-provider';

export function useCreatorProfile(id: string) {
  const { user, ready, getIdToken } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [profileViewer, setProfileViewer] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    // Subscribe to a new profile or refresh the counts after a relationship change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    if (!ready || !id) {
      setLoading(false);
      return;
    }
    void getIdToken()
      .then((token) => {
        if (userId && !token) throw new Error('SESSION_EXPIRED');
        return creatorRead<CreatorProfile>(
          `/creators/${encodeURIComponent(id)}`,
          token,
          controller.signal,
        );
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setProfile(value);
          setProfileViewer(userId ?? null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setProfile(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, userId, ready, getIdToken, version]);
  useEffect(() => {
    const visible = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('ambatu:friends-changed', refresh);
    window.addEventListener('ambatu:profile-changed', refresh);
    window.addEventListener('ambatu:clips-changed', refresh);
    return () => {
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('ambatu:friends-changed', refresh);
      window.removeEventListener('ambatu:profile-changed', refresh);
      window.removeEventListener('ambatu:clips-changed', refresh);
    };
  }, [refresh]);
  return {
    profile: profile?.id === id && profileViewer === (userId ?? null) ? profile : null,
    setProfile,
    loading,
    error,
    refresh,
  };
}
