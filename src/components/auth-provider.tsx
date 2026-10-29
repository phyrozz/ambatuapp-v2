'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { beginGoogleSignIn, cognitoConfigured, getValidSession, revokeStoredSession, type CognitoUser } from '@/lib/cognito';
import { initializePlayerProfile, recordPlayerActivity } from '@/lib/player-profile';

type AuthContext = {
  ready: boolean;
  configured: boolean;
  user: CognitoUser | null;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  setDisplayName: (name: string) => void;
  getAccessToken: () => Promise<string | null>;
  getIdToken: () => Promise<string | null>;
};
const Context = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [ready, setReady] = useState(false);
  const playerId = user?.id;
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let activeSession: Awaited<ReturnType<typeof getValidSession>> = null;
    const syncProfile = () => {
      const session = activeSession;
      if (!session) return;
      void initializePlayerProfile(session.tokens.idToken, controller.signal)
        .then(profile => {
          if (!cancelled && document.visibilityState === 'visible') {
            void recordPlayerActivity(session.tokens.idToken, controller.signal).catch(() => {});
          }
          if (!cancelled) setUser(current => {
            if (!current || current.id !== session.user.id) return current;
            return { ...current, name: profile.username, avatarUrl: profile.avatarUrl ?? null };
          });
        })
        .catch(() => { /* Profile registration is retried on the next visit. */ });
    };
    window.addEventListener('ambatu:profile-changed', syncProfile);
    void getValidSession().then((session) => {
      if (cancelled) return;
      activeSession = session;
      setUser(session?.user ?? null);
      setReady(true);
      syncProfile();
    });
    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener('ambatu:profile-changed', syncProfile);
    };
  }, []);
  useEffect(() => {
    if (!playerId) return;
    const controller = new AbortController();
    const record = () => {
      if (document.visibilityState !== 'visible') return;
      void getValidSession().then(session => {
        if (session && session.user.id === playerId && !controller.signal.aborted) {
          return recordPlayerActivity(session.tokens.idToken, controller.signal);
        }
      }).catch(() => {});
    };
    record();
    const timer = window.setInterval(record, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', record);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', record);
    };
  }, [playerId]);
  const signInWithGoogle = useCallback(async (returnTo?: string) => beginGoogleSignIn(returnTo), []);
  const signOut = useCallback(async () => {
    setUser(null);
    await revokeStoredSession();
  }, []);
  const setDisplayName = useCallback((name: string) => setUser(current => current ? { ...current, name } : current), []);
  const getAccessToken = useCallback(async () => (await getValidSession())?.tokens.accessToken ?? null, []);
  const getIdToken = useCallback(async () => (await getValidSession())?.tokens.idToken ?? null, []);
  return <Context.Provider value={{ ready, configured: cognitoConfigured, user, signInWithGoogle, signOut, setDisplayName, getAccessToken, getIdToken }}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
