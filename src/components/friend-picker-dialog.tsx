'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Pin, Search, UsersRound, X } from 'lucide-react';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import { FriendsDialog } from './friends-dialog';
import { useFriends, type Friend } from './use-friends';

export function FriendAvatar({ friend }: { friend: Pick<Friend, 'username' | 'avatarUrl'> }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="friend-avatar" aria-hidden="true">
      {friend.avatarUrl && !failed ? (
        <img src={friend.avatarUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        friend.username.slice(0, 1).toLocaleUpperCase()
      )}
    </span>
  );
}

export function FriendPickerDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  group = false,
  limit = 24,
  exclude = [],
  disabled = false,
  errorKey = 'social.error',
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: (friends: Friend[], groupTitle: string) => Promise<void>;
  onClose: () => void;
  group?: boolean;
  limit?: number;
  exclude?: string[];
  disabled?: boolean;
  errorKey?: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Friend[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pane, setPane] = useState<HTMLDivElement | null>(null);
  const pending = useRef(false);
  const { sentinel, ...list } = useFriends({
    state: 'accepted',
    pinned,
    search,
    root: pane,
    enabled: !query.trim() || search.length >= 2,
  });
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const visible = list.items.filter((friend) => !exclude.includes(friend.id));
  const atLimit = selected.length >= limit;
  async function confirm() {
    if (pending.current || disabled || !selected.length || (group && !groupTitle.trim())) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm(selected, groupTitle.trim());
    } catch (reason) {
      setError(
        t(
          reason instanceof Error && reason.message === 'CHAT_RESTRICTED'
            ? 'chat.restricted'
            : errorKey,
        ),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <FriendsDialog
      title={title}
      description={description ?? t('friends.pickerHint')}
      onClose={onClose}
      busy={busy}
    >
      {group && (
        <label className="friends-field">
          {t('chat.groupName')}
          <input
            autoComplete="off"
            maxLength={80}
            value={groupTitle}
            onChange={(event) => setGroupTitle(event.target.value)}
            disabled={busy}
          />
        </label>
      )}
      <label className="friends-search">
        <Search size={18} />
        <input
          type="search"
          value={query}
          maxLength={24}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('friends.searchFriends')}
          aria-label={t('friends.searchFriends')}
          disabled={busy}
        />
      </label>
      <div className="friends-filter">
        <button
          type="button"
          disabled={busy}
          aria-pressed={!pinned}
          className={!pinned ? 'selected' : ''}
          onClick={() => setPinned(false)}
        >
          {t('friends.allFriends')}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={pinned}
          className={pinned ? 'selected' : ''}
          onClick={() => setPinned(true)}
        >
          <Pin size={14} />
          {t('friends.pinned')}
        </button>
        <small>{t('friends.selectionCount', { count: selected.length })}</small>
      </div>
      {selected.length > 0 && (
        <div className="friends-selected">
          {selected.map((friend) => (
            <button
              type="button"
              key={friend.id}
              disabled={busy}
              onClick={() => setSelected((items) => items.filter((item) => item.id !== friend.id))}
              aria-label={t('friends.removeSelected', { name: friend.username })}
            >
              {friend.username}
              <X size={14} />
            </button>
          ))}
        </div>
      )}
      <div className="friend-picker-list" ref={setPane} aria-busy={list.loading}>
        {visible.map((friend) => {
          const checked = selected.some((item) => item.id === friend.id);
          return (
            <button
              type="button"
              className={`friend-picker-row${checked ? ' selected' : ''}`}
              key={friend.id}
              aria-label={friend.username}
              title={friend.pinned ? t('friends.pinned') : undefined}
              aria-pressed={checked}
              disabled={busy || (!checked && atLimit)}
              onClick={() =>
                setSelected((items) =>
                  checked ? items.filter((item) => item.id !== friend.id) : [...items, friend],
                )
              }
            >
              <FriendAvatar friend={friend} />
              <strong>{friend.username}</strong>
              {friend.pinned && <Pin className="friend-picker-pin" size={14} aria-hidden="true" />}
              <span className="friend-picker-check" aria-hidden="true">
                {checked && <Check size={16} />}
              </span>
            </button>
          );
        })}
        {!list.loading && !list.error && !visible.length && (
          <div className="friends-empty compact">
            <UsersRound size={28} />
            <p>
              {t(
                search.length >= 2
                  ? 'friends.noResults'
                  : query.trim()
                    ? 'friends.searchPrompt'
                    : pinned
                      ? 'friends.emptyPinned'
                      : 'friends.emptyFriendsHint',
              )}
            </p>
            {!query.trim() && !pinned && (
              <Link href="/friends/?tab=find" onClick={onClose}>
                {t('friends.findPeople')}
              </Link>
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
      {limit > 1 && (
        <small className="friends-selection-limit">
          {t('friends.selectionLimit', { count: limit })}
        </small>
      )}
      {error && (
        <p className="friends-error" role="alert">
          {error}
        </p>
      )}
      <footer className="friends-dialog-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
          {t('friends.cancelAction')}
        </button>
        <button
          type="button"
          className="button dark"
          disabled={disabled || busy || !selected.length || (group && !groupTitle.trim())}
          onClick={() => void confirm()}
        >
          {busy && <LoadingIndicator compact label={t('common.loading')} />}
          <UsersRound size={17} />
          {confirmLabel}
        </button>
      </footer>
    </FriendsDialog>
  );
}
