'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, MessageCircle, Search, UsersRound } from 'lucide-react';
import { ChatSocket, type ChatConversation } from '@/lib/chat';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import { FriendsDialog } from './friends-dialog';
import { FriendAvatar } from './friend-picker-dialog';
import { useFriends, type Friend } from './use-friends';

type ConversationCursor = { pk: string; sk: string; updatedAt: number };
type ShareRecipient = { key: string; name: string; friend?: Friend; conversation?: ChatConversation };

function isConversationCursor(value: unknown): value is ConversationCursor {
  if (!value || typeof value !== 'object') return false;
  const cursor = value as Partial<ConversationCursor>;
  return typeof cursor.pk === 'string' && typeof cursor.sk === 'string' && typeof cursor.updatedAt === 'number';
}

function mergeConversations(existing: ChatConversation[], incoming: ChatConversation[]) {
  const merged = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => merged.set(item.id, item));
  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function ClipSharePickerDialog({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  const { t } = useI18n();
  const { user, getAccessToken } = useAuth();
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [chatsReady, setChatsReady] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [chatsError, setChatsError] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState(false);
  const [chatPane, setChatPane] = useState<HTMLDivElement | null>(null);
  const [chatSentinel, setChatSentinel] = useState<HTMLDivElement | null>(null);
  const loadChats = useRef<() => void>(() => {});
  const [friendQueryInput, setFriendQueryInput] = useState('');
  const [friendQuery, setFriendQuery] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<ShareRecipient[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [firstConversation, setFirstConversation] = useState('');
  const sent = useRef(new Map<string, string>());
  const { items: friendItems, loading: friendLoading, error: friendError, ended: friendsEnded, sentinel: friendSentinel, retry: retryFriends } = useFriends({
    state: 'accepted',
    search: friendQuery,
    enabled: !friendQueryInput.trim() || friendQuery.length >= 2,
    root: chatPane,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setFriendQuery(friendQueryInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [friendQueryInput]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let cursor: ConversationCursor | null = null;
    let pending = false;
    let done = false;
    const socket = new ChatSocket();
    const next = async () => {
      if (cancelled || pending || done) return;
      pending = true;
      setChatsLoading(true);
      setChatsError(false);
      try {
        if (!socket.isOpen) {
          const url = process.env.NEXT_PUBLIC_CHAT_WS_URL;
          const token = await getAccessToken();
          if (!url || !token) throw new Error('CHAT_UNAVAILABLE');
          await socket.connect(url, token);
        }
        if (cancelled) return;
        const data = await socket.request('conversations', cursor ? { cursor } : {});
        if (cancelled) return;
        const page = (data.conversations as ChatConversation[] ?? [])
          .filter((conversation) => conversation.members.includes(user.id))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setChats((previous) => mergeConversations(previous, page));
        cursor = isConversationCursor(data.nextCursor) ? data.nextCursor : null;
        done = !cursor;
        setHasMoreChats(Boolean(cursor));
        setChatsReady(true);
      } catch {
        if (!cancelled) {
          socket.close();
          setChatsError(true);
        }
      } finally {
        pending = false;
        if (!cancelled) setChatsLoading(false);
      }
    };
    loadChats.current = () => { void next(); };
    void next();
    return () => {
      cancelled = true;
      socket.close();
    };
  }, [getAccessToken, user]);

  useEffect(() => {
    if (!hasMoreChats || chatsLoading || chatsError || !chatPane || !chatSentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadChats.current();
    }, { root: chatPane, rootMargin: '120px' });
    observer.observe(chatSentinel);
    return () => observer.disconnect();
  }, [chats.length, hasMoreChats, chatsLoading, chatsError, chatPane, chatSentinel]);

  const selectedCount = selectedRecipients.length;
  const selectedLimitReached = selectedCount >= 24;
  const chatQuery = friendQueryInput.trim().length < 2 ? friendQueryInput.trim().toLocaleLowerCase() : friendQuery.toLocaleLowerCase();
  const friendIds = new Set(friendItems.map((friend) => friend.id));
  const visibleChats = chats.filter((conversation) => {
    const otherId = conversation.members.find((id) => id !== user?.id) ?? '';
    if (!conversation.group && otherId && friendIds.has(otherId)) return false;
    if (!chatQuery) return true;
    const title = conversation.group ? conversation.title : conversation.title || conversation.names[otherId];
    return [title, conversation.lastMessage, ...Object.values(conversation.names)].some((value) => value?.toLocaleLowerCase().includes(chatQuery));
  });
  const showChats = friendsEnded || friendError || (friendQueryInput.trim().length > 0 && friendQuery.length < 2);

  async function sendSelected() {
    if (!user || sending || !selectedCount) return;
    setSending(true);
    setSendError(false);
    const socket = new ChatSocket();
    try {
      const url = process.env.NEXT_PUBLIC_CHAT_WS_URL;
      const token = await getAccessToken();
      if (!url || !token) throw new Error('CHAT_UNAVAILABLE');
      await socket.connect(url, token);
      for (const recipient of selectedRecipients) {
        let conversation = recipient.conversation?.id;
        if (!conversation && recipient.friend) {
          const friend = recipient.friend;
          const result = await socket.request('createConversation', {
            members: [friend.id],
            names: { [friend.id]: friend.username, [user.id]: user.name },
          });
          conversation = String(result.conversation);
        }
        if (!conversation || sent.current.has(conversation)) continue;
        await socket.request('send', { conversation, kind: 'text', text: message });
        sent.current.set(conversation, conversation);
      }
      setSentCount(sent.current.size);
      setFirstConversation([...sent.current.keys()][0] ?? '');
    } catch {
      setSendError(true);
    } finally {
      socket.close();
      setSending(false);
    }
  }

  if (sentCount) {
    return <FriendsDialog
      title={t(sentCount === 1 ? 'chat.sharedOneRecipient' : 'chat.sharedRecipients', { count: sentCount })}
      description={title}
      onClose={onClose}
    >
      <div className="friends-share-success" aria-hidden="true"><Check size={32} /></div>
      <footer className="friends-dialog-actions">
        <button type="button" className="button secondary" onClick={onClose}>{t('friends.done')}</button>
        <Link className="button dark" href={`/chat/?conversation=${encodeURIComponent(firstConversation)}`} onClick={onClose}>
          <MessageCircle size={17} />{t('friends.openChat')}
        </Link>
      </footer>
    </FriendsDialog>;
  }

  return <FriendsDialog
    title={t('friends.shareClip')}
    description={`${title} — ${t('chat.shareClipHint')}`}
    onClose={onClose}
    busy={sending}
  >
    <label className="friends-search">
      <Search size={18} />
      <input type="search" value={friendQueryInput} onChange={(event) => setFriendQueryInput(event.target.value)} placeholder={t('friends.searchFriends')} aria-label={t('friends.searchFriends')} disabled={sending} />
    </label>
    <div className="friends-filter">
      <small>{t('friends.selectionCount', { count: selectedCount })}</small>
    </div>
    {selectedRecipients.length > 0 && <div className="friends-selected">
      {selectedRecipients.map((recipient) => <button key={recipient.key} type="button" disabled={sending} aria-label={t('friends.removeSelected', { name: recipient.name })} onClick={() => setSelectedRecipients((items) => items.filter((item) => item.key !== recipient.key))}>
        {recipient.name}<span aria-hidden="true">×</span>
      </button>)}
    </div>}
    <div className="friend-picker-list clip-share-list" ref={setChatPane} aria-busy={friendLoading || (showChats && chatsLoading)}>
      {friendItems.map((friend) => {
        const key = `friend:${friend.id}`;
        const checked = selectedRecipients.some((item) => item.key === key);
        return <button key={key} type="button" className={`friend-picker-row${checked ? ' selected' : ''}`} aria-label={friend.username} aria-pressed={checked} disabled={sending || (!checked && selectedLimitReached)} onClick={() => setSelectedRecipients((items) => checked ? items.filter((item) => item.key !== key) : [...items, { key, name: friend.username, friend }])}>
          <FriendAvatar friend={friend} /><strong>{friend.username}</strong><span className="friend-picker-check" aria-hidden="true">{checked && <Check size={16} />}</span>
        </button>;
      })}
      <div ref={friendSentinel} className="friends-sentinel" />
      {friendLoading && <LoadingIndicator label={t('common.loading')} />}
      {friendError && <div className="friends-error" role="alert"><p>{t('social.error')}</p><button type="button" className="button secondary compact" onClick={retryFriends}>{t('social.retry')}</button></div>}
      {friendQueryInput.trim().length > 0 && friendQueryInput.trim().length < 2 && <div className="friends-empty compact"><p>{t('friends.searchPrompt')}</p></div>}
      {showChats && visibleChats.map((conversation) => {
        const otherId = conversation.members.find((id) => id !== user?.id) ?? '';
        const name = conversation.group ? conversation.title || t('chat.groupChat') : conversation.title || conversation.names[otherId] || t('chat.directMessage');
        const key = `conversation:${conversation.id}`;
        const checked = selectedRecipients.some((item) => item.key === key);
        return <button key={key} type="button" className={`friend-picker-row${checked ? ' selected' : ''}`} aria-label={name} aria-pressed={checked} disabled={sending || (!checked && selectedLimitReached)} onClick={() => setSelectedRecipients((items) => checked ? items.filter((item) => item.key !== key) : [...items, { key, name, conversation }])}>
          <span className="clip-share-conversation-icon" aria-hidden="true">{conversation.group ? <UsersRound size={18} /> : <MessageCircle size={18} />}</span>
          <span className="clip-share-conversation-label"><strong>{name}</strong>{conversation.group && <small>{t('chat.memberCount', { count: conversation.members.length })}</small>}</span>
          <span className="friend-picker-check" aria-hidden="true">{checked && <Check size={16} />}</span>
        </button>;
      })}
      {showChats && chatsLoading && <LoadingIndicator label={t('common.loading')} />}
      {showChats && chatsError && <div className="friends-error" role="alert"><p>{t('social.error')}</p><button type="button" className="button secondary compact" onClick={() => loadChats.current()}>{t('social.retry')}</button></div>}
      {showChats && chatsReady && !chatsLoading && !chatsError && !hasMoreChats && !visibleChats.length && !friendItems.length && (friendsEnded || !friendQueryInput.trim()) && <div className="friends-empty compact"><MessageCircle size={28} /><p>{t('chat.noChatsToShare')}</p></div>}
      {showChats && <div ref={setChatSentinel} className="friends-sentinel" />}
    </div>
    <small className="friends-selection-limit">{t('chat.shareSelectionLimit', { count: 24 })}</small>
    {sendError && <p className="friends-error" role="alert">{t('chat.shareError')}</p>}
    <footer className="friends-dialog-actions">
      <button type="button" className="button secondary" disabled={sending} onClick={onClose}>{t('friends.cancelAction')}</button>
      <button type="button" className="button dark" disabled={sending || !selectedCount} onClick={() => void sendSelected()}>
        {sending && <LoadingIndicator compact label={t('common.loading')} />}
        <MessageCircle size={17} />{t('friends.send')}
      </button>
    </footer>
  </FriendsDialog>;
}
