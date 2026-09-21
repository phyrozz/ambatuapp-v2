'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { beginGoogleSignIn, cognitoConfigured, getValidSession, revokeStoredSession, type CognitoUser } from '@/lib/cognito';

type AuthContext = {
  ready: boolean;
  configured: boolean;
  user: CognitoUser | null;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  getIdToken: () => Promise<string | null>;
};
const Context = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void getValidSession().then((session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
  }, []);
  const signInWithGoogle = useCallback(async (returnTo?: string) => beginGoogleSignIn(returnTo), []);
  const signOut = useCallback(async () => {
    setUser(null);
    await revokeStoredSession();
  }, []);
  const getAccessToken = useCallback(async () => (await getValidSession())?.tokens.accessToken ?? null, []);
  const getIdToken = useCallback(async () => (await getValidSession())?.tokens.idToken ?? null, []);
  return <Context.Provider value={{ ready, configured: cognitoConfigured, user, signInWithGoogle, signOut, getAccessToken, getIdToken }}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
