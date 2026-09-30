'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { memberApi } from '@/lib/member-api';

const Context = createContext({ incomingCount: 0, refresh: () => {} });

export function FriendRequestProvider({ children }: { children: React.ReactNode }) {
  const { ready, user, getIdToken } = useAuth();
  const [incomingCount, setIncomingCount] = useState(0);
  const refresh = useCallback(() => {
    if (!ready || !user) { setIncomingCount(0); return; }
    void getIdToken().then(token => memberApi<{ incomingCount: number }>('/friends/summary', token)).then(data => setIncomingCount(Math.max(0, data.incomingCount))).catch(() => {});
  }, [ready, user, getIdToken]);
  useEffect(() => {
    const check = () => { if (!document.hidden) refresh(); };
    const timer = window.setInterval(check, 45000);
    window.addEventListener('focus', check);
    window.addEventListener('ambatu:friends-changed', refresh);
    document.addEventListener('visibilitychange', check);
    check();
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check); window.removeEventListener('ambatu:friends-changed', refresh); document.removeEventListener('visibilitychange', check); };
  }, [refresh]);
  return <Context.Provider value={{ incomingCount, refresh }}>{children}</Context.Provider>;
}

export const useFriendRequests = () => useContext(Context);
