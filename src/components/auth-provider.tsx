'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { beginGoogleSignIn, cognitoConfigured, getValidSession, revokeStoredSession, type CognitoUser } from '@/lib/cognito';
import { initializePlayerProfile } from '@/lib/player-profile';

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
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void getValidSession().then((session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setReady(true);
      if (session) void initializePlayerProfile(session.tokens.idToken, controller.signal)
        .then(profile => { if (!cancelled) setUser(current => current?.id === session.user.id ? { ...current, name: profile.username } : current); })
        .catch(() => { /* Profile registration is retried on the next visit. */ });
    });
    return () => { cancelled = true; controller.abort(); };
  }, []);
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
