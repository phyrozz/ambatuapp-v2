'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { memberApi } from '@/lib/member-api';
import { LoadingIndicator } from './loading-indicator';
import { useFriendRequests } from './friend-request-provider';
type Friend = { id: string; username: string; avatarUrl: string | null; state: 'accepted' | 'incoming' | 'outgoing' | null };

export function Friends() {
  const { getIdToken } = useAuth();
  const { t } = useI18n();
  const { incomingCount, refresh } = useFriendRequests();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState(0);
  const [items, setItems] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const load = useRef<() => void>(() => {});
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | null = null, pending = false, done = false;
    // Reset the paginated subscription when its search or refresh generation changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]); setError(false);
    const next = async () => {
      if (pending || done || controller.signal.aborted) return;
      if (search && search.length < 2) { setLoading(false); return; }
      pending = true; setLoading(true); setError(false);
      try {
        const params = new URLSearchParams(search ? { q: search } : {});
        if (cursor) params.set('cursor', cursor);
        const data = await memberApi<{ friends: Friend[]; nextCursor: string | null }>(`/friends${search ? '/search' : ''}?${params}`, await getIdToken(), controller.signal);
        if (controller.signal.aborted) return;
        setItems(previous => [...new Map([...previous, ...data.friends].map(item => [item.id, item])).values()]);
        cursor = data.nextCursor; done = !cursor;
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { pending = false; if (!controller.signal.aborted) setLoading(false); }
    };
    load.current = () => { void next(); };
    void next();
    return () => controller.abort();
  }, [search, version, getIdToken]);
  useEffect(() => {
    if (!sentinel.current || error || loading) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) load.current(); }, { rootMargin: '300px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [items, error, loading]);
  const act = useCallback(async (targetId: string, action: string) => {
    if (busy) return;
    setBusy(targetId); setError(false);
    try {
      const result = await memberApi<{ state: Friend['state'] }>('/friends', await getIdToken(), undefined, { targetId, action });
      setItems(previous => previous.flatMap(item => item.id !== targetId ? [item] : result.state || search ? [{ ...item, state: result.state }] : []));
      refresh();
    } catch { setError(true); }
    finally { setBusy(''); }
  }, [busy, getIdToken, search, refresh]);
  return <section className="page friends-page"><h1>{t('friends.title')}{incomingCount > 0 && <span className="friends-heading-count" aria-label={t('friends.requestCount', { count: incomingCount })}>{incomingCount}</span>}</h1><p>{t('friends.description')}</p>
    <label className="friend-search">{t('friends.search')}<input type="search" maxLength={24} value={query} onChange={event => setQuery(event.target.value)} placeholder={t('friends.searchHint')} /></label>
    <button className="button secondary compact" onClick={() => setVersion(value => value + 1)} disabled={loading}>{t('friends.refresh')}</button>
    <div className="friends-list">{items.map(item => <article className="friend-row" key={item.id}>
      {item.avatarUrl && <img src={item.avatarUrl} alt="" />}<div><b>{item.username}</b>{item.state && <small>{t(`friends.${item.state}`)}</small>}</div>
      <div className="friend-actions">{item.state === 'accepted' && <Link className="button dark compact" href={`/chat/?user=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.username)}`}>{t('chat.startChat')}</Link>}
      {(!item.state || item.state === 'incoming') && <button className="button dark compact" disabled={!!busy} onClick={() => void act(item.id, item.state === 'incoming' ? 'accept' : 'request')}>{t(item.state === 'incoming' ? 'friends.accept' : 'friends.add')}</button>}
      {item.state && <button className="button secondary compact" disabled={!!busy} onClick={() => void act(item.id, 'remove')}>{t(item.state === 'incoming' ? 'friends.decline' : item.state === 'outgoing' ? 'friends.cancel' : 'friends.remove')}</button>}</div>
    </article>)}</div>
    {!loading && !items.length && !error && <p>{t(search ? 'friends.noResults' : 'friends.empty')}</p>}
    {loading && <LoadingIndicator label={t('common.loading')} />}{error && <div role="alert"><p>{t('social.error')}</p><button className="button secondary" onClick={() => setVersion(value => value + 1)}>{t('social.retry')}</button></div>}<div ref={sentinel} />
  </section>;
}
