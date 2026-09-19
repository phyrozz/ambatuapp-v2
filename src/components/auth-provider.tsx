'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { beginGoogleSignIn, clearStoredSession, cognitoConfigured, getStoredSession, type CognitoUser } from '@/lib/cognito';

type AuthContext = {
  ready: boolean;
  configured: boolean;
  user: CognitoUser | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
  getAccessToken: () => string | null;
  getIdToken: () => string | null;
};
const Context = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [ready, setReady] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- browser storage can only be read after hydration. */
  useEffect(() => {
    setUser(getStoredSession()?.user ?? null);
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const signInWithGoogle = useCallback(async () => beginGoogleSignIn(), []);
  const signOut = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);
  const getAccessToken = useCallback(() => getStoredSession()?.tokens.accessToken ?? null, []);
  const getIdToken = useCallback(() => getStoredSession()?.tokens.idToken ?? null, []);
  return <Context.Provider value={{ ready, configured: cognitoConfigured, user, signInWithGoogle, signOut, getAccessToken, getIdToken }}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
