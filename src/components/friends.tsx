'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Gamepad2,
  MessageCircle,
  Pin,
  Search,
  Share2,
  UserMinus,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { memberApi } from '@/lib/member-api';
import { friendLink } from '@/lib/share-links';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import { useFriendRequests } from './friend-request-provider';
import { ChatShareDialog } from './chat-share-dialog';
import { FriendAvatar } from './friend-picker-dialog';
import { FriendsDialog } from './friends-dialog';
import { useFriends, type Friend } from './use-friends';
import './friends.css';

type Tab = 'friends' | 'requests' | 'find';

export function Friends() {
  const { user, getIdToken } = useAuth();
  const { t } = useI18n();
  const params = useSearchParams();
  const target = params.get('user');
  const { incomingCount, refresh } = useFriendRequests();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'find' ? 'find' : 'friends');
  const [outgoing, setOutgoing] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [removing, setRemoving] = useState<Friend | null>(null);
  const [linked, setLinked] = useState<Friend | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [linkVersion, setLinkVersion] = useState(0);
  const pending = useRef(false);
  const state =
    tab === 'friends'
      ? 'accepted'
      : tab === 'requests'
        ? outgoing
          ? 'outgoing'
          : 'incoming'
        : undefined;
  const { sentinel, ...list } = useFriends({
    state,
    pinned: tab === 'friends' && pinned,
    search: tab === 'find' ? search : '',
    enabled: tab !== 'find' || search.length >= 2,
  });
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinked(null);
    setLinkError(false);
    if (!target || target === user?.id) {
      setLinkLoading(false);
      return;
    }
    setLinkLoading(true);
    void getIdToken()
      .then((token) =>
        memberApi<{ friend: Friend }>(
          `/friends/${encodeURIComponent(target)}`,
          token,
          controller.signal,
        ),
      )
      .then((data) => {
        if (!controller.signal.aborted) setLinked(data.friend);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLinkError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLinkLoading(false);
      });
    return () => controller.abort();
  }, [target, user?.id, getIdToken, linkVersion]);
  async function act(friend: Friend, action: string) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(friend.id);
    setActionError(false);
    try {
      const result = await memberApi<{ state: Friend['state']; pinned: boolean }>(
        '/friends',
        await getIdToken(),
        undefined,
        { targetId: friend.id, action },
      );
      const updated = { ...friend, ...result };
      list.setItems((previous) =>
        previous.flatMap((item) =>
          item.id !== friend.id
            ? [item]
            : tab === 'find' || (result.state === state && (!pinned || result.pinned))
              ? [updated]
              : [],
        ),
      );
      setLinked((item) => (item?.id === friend.id ? updated : item));
      refresh();
      window.dispatchEvent(new Event('ambatu:friends-changed'));
      return true;
    } catch {
      setActionError(true);
      return false;
    } finally {
      pending.current = false;
      setBusy('');
    }
  }

  const friendCard = (friend: Friend) => (
    <article className={`friend-card${friend.pinned ? ' is-pinned' : ''}`} key={friend.id}>
      <FriendAvatar friend={friend} />
      <div className="friend-card-copy">
        <strong>{friend.username}</strong>
        {friend.state && <small>{t(`friends.${friend.state}`)}</small>}
      </div>
      <div className="friend-card-actions">
        {friend.state === 'accepted' && (
          <>
            <Link
              className="button dark compact"
              href={`/chat/?user=${encodeURIComponent(friend.id)}&name=${encodeURIComponent(friend.username)}`}
            >
              <MessageCircle size={16} />
              {t('chat.startChat')}
            </Link>
            <button
              className={`friends-icon-button${friend.pinned ? ' selected' : ''}`}
              type="button"
              disabled={!!busy}
              aria-pressed={!!friend.pinned}
              aria-label={t(friend.pinned ? 'friends.unpin' : 'friends.pin', {
                name: friend.username,
              })}
              title={t(friend.pinned ? 'friends.unpin' : 'friends.pin', { name: friend.username })}
              onClick={() => void act(friend, friend.pinned ? 'unpin' : 'pin')}
            >
              <Pin size={18} />
            </button>
          </>
        )}
        {(!friend.state || friend.state === 'incoming') && (
          <button
            className="button dark compact"
            type="button"
            disabled={!!busy}
            onClick={() => void act(friend, friend.state === 'incoming' ? 'accept' : 'request')}
          >
            <UserPlus size={16} />
            {t(friend.state === 'incoming' ? 'friends.accept' : 'friends.add')}
          </button>
        )}
        {friend.state && (
          <button
            className={
              friend.state === 'accepted'
                ? 'friends-icon-button friend-remove'
                : 'button secondary compact'
            }
            type="button"
            disabled={!!busy}
            aria-label={t(
              friend.state === 'incoming'
                ? 'friends.decline'
                : friend.state === 'outgoing'
                  ? 'friends.cancel'
                  : 'friends.remove',
            )}
            onClick={() => {
              if (friend.state === 'accepted') setRemoving(friend);
              else void act(friend, 'remove');
            }}
          >
            {friend.state === 'accepted' ? (
              <UserMinus size={18} />
            ) : (
              t(friend.state === 'incoming' ? 'friends.decline' : 'friends.cancel')
            )}
          </button>
        )}
      </div>
    </article>
  );

  return (
    <section className="page friends-page">
      <header className="friends-hero">
        <div className="friends-hero-copy">
          <span className="eyebrow">{t('friends.eyebrow')}</span>
          <h1>
            {t('friends.title')}
            <span className="orange-text">.</span>
          </h1>
          <p>{t('friends.connectionHint')}</p>
          <div className="friends-hero-actions">
            <button
              type="button"
              className="button dark"
              onClick={() => {
                if (user) setShareUrl(friendLink(user.id));
              }}
            >
              <Share2 size={18} />
              {t('friends.shareLink')}
            </button>
            <Link className="button secondary" href="/chat/?compose=group">
              <UsersRound size={18} />
              {t('friends.newGroup')}
            </Link>
          </div>
        </div>
        <div className="friends-hero-art" aria-hidden="true">
          <span>
            <UsersRound size={58} />
          </span>
          <i>
            <MessageCircle size={22} />
          </i>
          <i>
            <Gamepad2 size={23} />
          </i>
        </div>
      </header>
      {target && (
        <section className="friends-link-card" aria-live="polite">
          {target === user?.id ? (
            <p>{t('friends.selfLink')}</p>
          ) : (
            <>
              {linkLoading && <LoadingIndicator label={t('common.loading')} />}{' '}
              {linked && (
                <>
                  <p className="eyebrow">{t('friends.linkTitle', { name: linked.username })}</p>
                  {friendCard(linked)}
                </>
              )}
              {linkError && (
                <div className="friends-error" role="alert">
                  <p>{t('friends.linkUnavailable')}</p>
                  <button
                    className="button secondary compact"
                    type="button"
                    onClick={() => setLinkVersion((value) => value + 1)}
                  >
                    {t('social.retry')}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
      <section className="friends-panel">
        <nav className="friends-tabs" aria-label={t('friends.title')}>
          {(['friends', 'requests', 'find'] as const).map((value) => (
            <button
              type="button"
              key={value}
              className={tab === value ? 'active' : ''}
              aria-pressed={tab === value}
              onClick={() => {
                setTab(value);
                setActionError(false);
              }}
            >
              {value === 'friends' ? (
                <UsersRound size={18} />
              ) : value === 'requests' ? (
                <UserPlus size={18} />
              ) : (
                <Search size={18} />
              )}
              <span>
                {t(
                  value === 'friends'
                    ? 'friends.title'
                    : value === 'requests'
                      ? 'friends.requests'
                      : 'friends.findPeople',
                )}
              </span>
              {value === 'requests' && incomingCount > 0 && (
                <span
                  className="friends-request-badge"
                  aria-label={t('friends.requestCount', { count: incomingCount })}
                >
                  {incomingCount > 99 ? '99+' : incomingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="friends-panel-body">
          {tab === 'friends' && (
            <>
              <div className="friends-filter">
                <button
                  type="button"
                  className={!pinned ? 'selected' : ''}
                  aria-pressed={!pinned}
                  onClick={() => setPinned(false)}
                >
                  {t('friends.allFriends')}
                </button>
                <button
                  type="button"
                  className={pinned ? 'selected' : ''}
                  aria-pressed={pinned}
                  onClick={() => setPinned(true)}
                >
                  <Pin size={14} />
                  {t('friends.pinned')}
                </button>
                <button
                  className="friends-refresh"
                  type="button"
                  disabled={list.loading}
                  onClick={list.refresh}
                >
                  {t('friends.refresh')}
                </button>
              </div>
              {pinned && <p className="friends-filter-hint">{t('friends.pinnedHint')}</p>}
            </>
          )}
          {tab === 'requests' && (
            <div className="friends-filter">
              <button
                type="button"
                className={!outgoing ? 'selected' : ''}
                aria-pressed={!outgoing}
                onClick={() => setOutgoing(false)}
              >
                {t('friends.received')}
              </button>
              <button
                type="button"
                className={outgoing ? 'selected' : ''}
                aria-pressed={outgoing}
                onClick={() => setOutgoing(true)}
              >
                {t('friends.sent')}
              </button>
            </div>
          )}
          {tab === 'find' && (
            <label className="friends-search">
              <Search size={19} />
              <input
                type="search"
                maxLength={24}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('friends.searchHint')}
                aria-label={t('friends.search')}
              />
            </label>
          )}
          {actionError && (
            <p className="friends-error" role="alert">
              {t('social.error')}
            </p>
          )}
          <div className="friends-list" aria-busy={list.loading}>
            {list.items.map(friendCard)}
          </div>
          {!list.loading && !list.items.length && !list.error && (
            <div className="friends-empty">
              <span>
                <UsersRound size={34} />
              </span>
              <h2>
                {t(
                  tab === 'find'
                    ? search.length < 2
                      ? 'friends.searchPrompt'
                      : 'friends.noResults'
                    : tab === 'requests'
                      ? outgoing
                        ? 'friends.emptyOutgoing'
                        : 'friends.emptyIncoming'
                      : pinned
                        ? 'friends.emptyPinned'
                        : 'friends.emptyFriends',
                )}
              </h2>
              {tab === 'friends' && !pinned && (
                <>
                  <p>{t('friends.emptyFriendsHint')}</p>
                  <button type="button" className="button secondary" onClick={() => setTab('find')}>
                    <UserPlus size={17} />
                    {t('friends.findPeople')}
                    <ArrowUpRight size={17} />
                  </button>
                </>
              )}
            </div>
          )}
          {list.loading && <LoadingIndicator label={t('common.loading')} />}
          {list.error && (
            <div className="friends-error" role="alert">
              <p>{t('social.error')}</p>
              <button className="button secondary compact" type="button" onClick={list.retry}>
                {t('social.retry')}
              </button>
            </div>
          )}
          <div ref={sentinel} className="friends-sentinel" />
        </div>
      </section>
      {shareUrl && <ChatShareDialog url={shareUrl} friend onClose={() => setShareUrl('')} />}
      {removing && (
        <FriendsDialog
          title={t('friends.removeTitle')}
          description={t('friends.removeHint', { name: removing.username })}
          busy={!!busy}
          onClose={() => setRemoving(null)}
        >
          {actionError && (
            <p className="friends-error" role="alert">
              {t('social.error')}
            </p>
          )}
          <footer className="friends-dialog-actions">
            <button
              className="button secondary"
              type="button"
              disabled={!!busy}
              onClick={() => setRemoving(null)}
            >
              {t('friends.cancelAction')}
            </button>
            <button
              className="button dark"
              type="button"
              disabled={!!busy}
              onClick={() =>
                void act(removing, 'remove').then((ok) => {
                  if (ok) setRemoving(null);
                })
              }
            >
              <UserMinus size={17} />
              {t('friends.remove')}
            </button>
          </footer>
        </FriendsDialog>
      )}
    </section>
  );
}
