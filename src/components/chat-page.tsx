'use client';
import './chat.css';

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AudioLines, Bell, Flag, ImagePlus, MessageCircle, Plus, Search, Send, UsersRound, X } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import { ChatSoundCard, ChatSoundPicker } from './chat-soundboard';
import { ChatReactions } from './chat-reactions';
import { ChatGroupMembers } from './chat-group-members';
import { ChatShareDialog, publicChatUrl } from './chat-share-dialog';
import { ChatSocket, withCurrentNames, type ChatConversation, type ChatMessage } from '@/lib/chat';
import { initializePlayerProfile } from '@/lib/player-profile';
import { enableChatPush, installPushNavigation, syncChatPush } from '@/lib/push-notifications';

type Player = { id: string; username: string };
type InviteDetails = { conversation: string; title: string; memberCount: number; alreadyMember: boolean };
const wsUrl = process.env.NEXT_PUBLIC_CHAT_WS_URL;
const playersApi = `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/players`;
const playerNamesApi = `${playersApi}/names`;
const ChatEmojiPicker = lazy(() => import('./chat-emoji-picker'));

export function ChatPage() {
  const { t, locale } = useI18n();
  const { ready, user, getAccessToken, getIdToken, signInWithGoogle } = useAuth();
  const userId = user?.id;
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'connecting' | 'ready' | 'unavailable'>('connecting');
  const [reconnect, setReconnect] = useState(0);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [initialChatsLoaded, setInitialChatsLoaded] = useState(false);
  const [active, setActive] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistoryFor, setLoadingHistoryFor] = useState('');
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Player[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<Player[]>([]);
  const [group, setGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [reactionPickerMessageKey, setReactionPickerMessageKey] = useState('');
  const [reactionToolbarMessageKey, setReactionToolbarMessageKey] = useState('');
  const [reactionToolbarClosing, setReactionToolbarClosing] = useState(false);
  const [revealedReactionMessageKey, setRevealedReactionMessageKey] = useState('');
  const [reactingMessageKey, setReactingMessageKey] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersBusy, setMembersBusy] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [sharing, setSharing] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const socket = useRef<ChatSocket | null>(null);
  const activeRef = useRef('');
  const initialUser = useRef(false);
  const initialInvite = useRef(false);
  const resolvedNames = useRef<Record<string, string>>({});
  const lastNamesFetch = useRef(0);
  const namesFetchVersion = useRef(0);
  const messagePane = useRef<HTMLDivElement>(null);
  const historyRequest = useRef(false);
  const stickToBottom = useRef(true);
  const restoreScroll = useRef<{ conversation: string; height: number; top: number } | null>(null);
  const reactionToolbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionHoldStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { installPushNavigation(() => socket.current, locale, user?.id ?? null, path => router.push(path)); }, [locale, router, user?.id]);
  useEffect(() => {
    if (status === 'ready' && userId && socket.current) void syncChatPush(socket.current, locale, userId);
  }, [locale, status, userId]);

  const refresh = useCallback(async (client: ChatSocket) => {
    const data = await client.request('conversations');
    const next = (data.conversations as ChatConversation[] ?? []).sort((a, b) => b.updatedAt - a.updatedAt)
      .map(item => withCurrentNames(item, resolvedNames.current));
    setConversations(next);
    if (activeRef.current && !next.some(item => item.id === activeRef.current)) {
      activeRef.current = '';
      setActive('');
      setMessages([]);
      setMembersOpen(false);
    }
    const ids = [...new Set(next.flatMap(item => [...item.members, ...Object.keys(item.names)]))];
    if (!ids.length || Date.now() - lastNamesFetch.current < 15000) return;
    lastNamesFetch.current = Date.now();
    const version = ++namesFetchVersion.current;
    void (async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error('token');
        const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => ids.slice(index * 100, (index + 1) * 100));
        const results = await Promise.all(chunks.map(async chunk => {
          const response = await fetch(playerNamesApi, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ ids: chunk }), cache: 'no-store' });
          if (!response.ok) throw new Error('names');
          return (await response.json() as { names: Record<string, string> }).names;
        }));
        if (version !== namesFetchVersion.current) return;
        resolvedNames.current = { ...resolvedNames.current, ...Object.assign({}, ...results) };
        setConversations(items => items.map(item => withCurrentNames(item, resolvedNames.current)));
      } catch { if (version === namesFetchVersion.current) lastNamesFetch.current = 0; }
    })();
  }, [getIdToken]);

  useEffect(() => {
    resolvedNames.current = {};
    lastNamesFetch.current = 0;
    namesFetchVersion.current++;
  }, [user?.id]);

  useEffect(() => {
    if (!ready || !user || !wsUrl) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let namesTimer: ReturnType<typeof setInterval> | undefined;
    let client: ChatSocket;
    const retry = () => {
      if (cancelled || retryTimer) return;
      setStatus('unavailable');
      retryTimer = setTimeout(() => setReconnect(value => value + 1), 2000);
    };
    const run = async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) { if (!cancelled) retry(); return; }
        client = new ChatSocket();
        socket.current = client;
        client.onMessage = (message) => {
          if (message.conversationId === activeRef.current) setMessages(items => items.some(item => item.id === message.id) ? items : [...items, message]);
          void refresh(client).catch(() => {});
        };
        client.onConversation = () => { void refresh(client).catch(() => {}); };
        client.onReaction = reaction => {
          if (reaction.conversationId === activeRef.current) setMessages(items => items.map(item => item.messageKey === reaction.messageKey ? { ...item, reactions: reaction.reactions } : item));
        };
        client.onClose = retry;
        await client.connect(wsUrl, token);
        if (cancelled) return client.close();
        setStatus('ready');
        setError('');
        await refresh(client);
        const checkConnection = () => {
          if (document.hidden || cancelled) return;
          if (!client.isOpen) { retry(); return; }
          void refresh(client).catch(() => { client.close(); retry(); });
        };
        namesTimer = setInterval(checkConnection, 30000);
        const onVisible = () => { if (!document.hidden) { lastNamesFetch.current = 0; checkConnection(); } };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('pageshow', onVisible);
        window.addEventListener('online', onVisible);
        visibilityCleanup = () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pageshow', onVisible); window.removeEventListener('online', onVisible); };
        if (!cancelled) setInitialChatsLoaded(true);
        const invite = params.get('invite');
        const target = params.get('user');
        if (invite && !initialInvite.current) {
          initialInvite.current = true;
          setInviteLoading(true);
          try {
            const details = await client.request('previewGroupInvite', { token: invite });
            if (!cancelled) setInviteDetails(details as InviteDetails);
          } catch (reason) {
            if (reason instanceof Error && ['socket', 'timeout'].includes(reason.message)) initialInvite.current = false;
            if (!cancelled) setInviteError(reason instanceof Error && ['socket', 'timeout'].includes(reason.message) ? t('chat.connectionError') : t('chat.inviteInvalid'));
          }
          finally { if (!cancelled) setInviteLoading(false); }
        } else if (target && target !== user.id && !initialUser.current) {
          initialUser.current = true;
          const name = params.get('name') ?? target;
          const data = await client.request('createConversation', { members: [target], names: { [target]: name, [user.id]: user.name } });
          const id = String(data.conversation);
          setLoadingHistoryFor(id);
          activeRef.current = id;
          setActive(id);
          await refresh(client);
        } else {
          const conversation = params.get('conversation');
          if (conversation && !initialInvite.current) {
            initialInvite.current = true;
            activeRef.current = conversation;
            setActive(conversation);
          }
        }
      } catch { if (!cancelled) { setError(t('chat.connectionError')); client?.close(); retry(); } }
    };
    let visibilityCleanup: (() => void) | undefined;
    void run();
    return () => { cancelled = true; clearTimeout(retryTimer); clearInterval(namesTimer); visibilityCleanup?.(); client?.close(); socket.current = null; };
  }, [ready, user, getAccessToken, params, refresh, reconnect, t]);

  useEffect(() => {
    if (!active || !socket.current || status !== 'ready') return;
    activeRef.current = active;
    stickToBottom.current = true;
    restoreScroll.current = null;
    setReactionPickerMessageKey('');
    if (reactionToolbarTimer.current) clearTimeout(reactionToolbarTimer.current);
    setReactionToolbarMessageKey('');
    setReactionToolbarClosing(false);
    setRevealedReactionMessageKey('');
    setMembersOpen(false);
    setHistoryCursor(null);
    let cancelled = false;
    socket.current.request('history', { conversation: active }).then(data => {
      if (!cancelled) {
        const page = data.messages as ChatMessage[] ?? [];
        setMessages(items => [...page, ...items.filter(item => item.conversationId === active && !page.some(message => message.id === item.id))].sort((a, b) => a.createdAt - b.createdAt));
        setHistoryCursor(typeof data.nextCursor === 'string' ? data.nextCursor : null);
      }
    }).catch(() => { if (!cancelled && socket.current?.isOpen) setError(t('chat.historyError')); }).finally(() => { if (!cancelled) setLoadingHistoryFor(''); });
    return () => { cancelled = true; };
  }, [active, status, reconnect, t]);
  useLayoutEffect(() => {
    const pane = messagePane.current;
    if (!pane) return;
    const pending = restoreScroll.current;
    if (pending && pending.conversation === active) {
      pane.scrollTop = pane.scrollHeight - pending.height + pending.top;
      restoreScroll.current = null;
    } else if (stickToBottom.current) pane.scrollTop = pane.scrollHeight;
  }, [messages, active]);

  async function loadOlderMessages() {
    if (!socket.current || !active || !historyCursor || historyRequest.current || loadingHistoryFor === active) return;
    historyRequest.current = true;
    setLoadingOlder(true);
    try {
      const data = await socket.current.request('history', { conversation: active, cursor: historyCursor });
      if (activeRef.current !== active) return;
      const pane = messagePane.current;
      if (pane) restoreScroll.current = { conversation: active, height: pane.scrollHeight, top: pane.scrollTop };
      const older = data.messages as ChatMessage[] ?? [];
      setMessages(items => [...older.filter(message => !items.some(item => item.id === message.id)), ...items]);
      setHistoryCursor(typeof data.nextCursor === 'string' ? data.nextCursor : null);
    } catch { if (activeRef.current === active) setError(t('chat.historyError')); }
    finally { historyRequest.current = false; setLoadingOlder(false); }
  }
  function closeReactionToolbar() {
    if (!reactionToolbarMessageKey || reactionToolbarClosing) return;
    setReactionToolbarClosing(true);
    if (reactionToolbarTimer.current) clearTimeout(reactionToolbarTimer.current);
    reactionToolbarTimer.current = setTimeout(() => { setReactionToolbarMessageKey(''); setReactionToolbarClosing(false); }, 180);
  }
  function toggleReactionToolbar(messageKey: string) {
    if (reactionToolbarMessageKey === messageKey && !reactionToolbarClosing) { closeReactionToolbar(); return; }
    if (reactionToolbarTimer.current) clearTimeout(reactionToolbarTimer.current);
    setReactionToolbarMessageKey(messageKey);
    setReactionToolbarClosing(false);
  }
  function clearReactionHold() {
    if (reactionHoldTimer.current) clearTimeout(reactionHoldTimer.current);
    reactionHoldTimer.current = null;
    reactionHoldStart.current = null;
  }
  function isMessageControl(target: EventTarget | null) {
    return target instanceof Element && !!target.closest('button, a, input, textarea, select, video, audio, [role="button"]');
  }
  function handleMessagePointerDown(event: ReactPointerEvent<HTMLElement>, messageKey?: string) {
    if (!Capacitor.isNativePlatform() || event.pointerType !== 'touch' || !messageKey || isMessageControl(event.target)) return;
    clearReactionHold();
    reactionHoldStart.current = { x: event.clientX, y: event.clientY };
    reactionHoldTimer.current = setTimeout(() => {
      setRevealedReactionMessageKey(messageKey);
      reactionHoldTimer.current = null;
    }, 450);
  }
  function handleMessagePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const start = reactionHoldStart.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clearReactionHold();
  }
  function handleMessageClick(event: ReactMouseEvent<HTMLElement>, messageKey?: string) {
    if (Capacitor.isNativePlatform() || !messageKey || isMessageControl(event.target) || !window.matchMedia('(hover: none)').matches) return;
    setRevealedReactionMessageKey(messageKey);
  }
  useEffect(() => {
    if (!revealedReactionMessageKey) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(`[data-reaction-message-key="${CSS.escape(revealedReactionMessageKey)}"]`)) setRevealedReactionMessageKey('');
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [revealedReactionMessageKey]);
  useEffect(() => () => { if (reactionToolbarTimer.current) clearTimeout(reactionToolbarTimer.current); clearReactionHold(); }, []);
  async function reactToMessage(messageKey: string, emoji: string) {
    if (!socket.current || !active) return;
    closeReactionToolbar();
    setRevealedReactionMessageKey('');
    setReactingMessageKey(messageKey); setError('');
    try {
      const data = await socket.current.request('react', { conversation: active, messageKey, emoji });
      setMessages(items => items.map(item => item.messageKey === messageKey ? { ...item, reactions: data.reactions as Record<string, string> } : item));
    } catch (reason) { setError(reason instanceof Error && reason.message === 'CHAT_RESTRICTED' ? t('chat.restricted') : t('chat.reactionError')); }
    finally { setReactingMessageKey(''); }
  }
  useEffect(() => {
    if (query.trim().length < 2 || !user) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const token = await getIdToken();
        const response = await fetch(`${playersApi}?q=${encodeURIComponent(query.trim())}`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error();
        setMatches(data.players ?? []);
      } catch { if (!controller.signal.aborted) setError(t('chat.searchError')); }
      finally { if (!controller.signal.aborted) setSearchLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, user, getIdToken, t]);

  async function createConversation() {
    if (!socket.current || !user || !selected.length || (group && !groupTitle.trim())) return;
    setBusy(true); setError('');
    try {
      const names = Object.fromEntries([...selected, { id: user.id, username: user.name }].map(item => [item.id, item.username]));
      const data = await socket.current.request('createConversation', { members: selected.map(item => item.id), names, group, title: groupTitle.trim() });
      const id = String(data.conversation);
      setMessages([]); setLoadingHistoryFor(id); setActive(id); activeRef.current = id; setSelected([]); setQuery(''); setSearchLoading(false); setGroup(false); setGroupTitle('');
      await refresh(socket.current);
    } catch (reason) { setError(reason instanceof Error && reason.message === 'CHAT_RESTRICTED' ? t('chat.restricted') : t('chat.createError')); } finally { setBusy(false); }
  }
  async function updateGroupMember(conversation: string, target: Player, adding: boolean) {
    if (!socket.current || !user) return;
    setMembersBusy(true); setMembersError('');
    try {
      const result = await socket.current.request(adding ? 'addGroupMember' : 'removeGroupMember', { conversation, userId: target.id, ...(adding ? { name: target.username } : {}) });
      if (!adding && target.id === user.id) {
        if (activeRef.current === conversation) returnToInbox();
        setConversations(items => items.filter(item => item.id !== conversation));
      } else {
        setConversations(items => items.map(item => item.id === conversation ? { ...item, members: result.members as string[], names: result.names as Record<string, string> } : item));
      }
      await refresh(socket.current);
    } catch (reason) { setMembersError(reason instanceof Error && reason.message === 'CHAT_RESTRICTED' ? t('chat.restricted') : t('chat.memberUpdateError')); }
    finally { setMembersBusy(false); }
  }
  async function shareGroup(conversation: string) {
    if (!socket.current || sharing) return;
    setSharing(true); setError('');
    try {
      const result = await socket.current.request('createGroupInvite', { conversation });
      setShareUrl(publicChatUrl({ invite: String(result.token) }));
    } catch (reason) { setError(reason instanceof Error && reason.message === 'CHAT_RESTRICTED' ? t('chat.restricted') : t('chat.inviteCreateError')); }
    finally { setSharing(false); }
  }
  function dismissInvite() {
    setInviteDetails(null); setInviteError(''); setInviteLoading(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  async function acceptInvite() {
    if (!socket.current || !user || !inviteDetails) return;
    setInviteBusy(true); setInviteError('');
    try {
      if (!inviteDetails.alreadyMember) {
        const token = await getIdToken();
        const profile = token ? await initializePlayerProfile(token).catch(() => null) : null;
        await socket.current.request('acceptGroupInvite', { token: params.get('invite'), name: profile?.username ?? user.name });
      }
      const id = inviteDetails.conversation;
      dismissInvite();
      setMessages([]); setLoadingHistoryFor(id); activeRef.current = id; setActive(id);
      await refresh(socket.current);
    } catch (reason) { setInviteError(reason instanceof Error && reason.message === 'CHAT_RESTRICTED' ? t('chat.restricted') : t('chat.inviteAcceptError')); }
    finally { setInviteBusy(false); }
  }
  async function send(kind: ChatMessage['kind'], text = '', key = '') {
    if (!socket.current || !active) return;
    setBusy(true); setError('');
    try {
      const result = await socket.current.request('send', { conversation: active, kind, text, key });
      const message = result.message as ChatMessage;
      stickToBottom.current = true;
      setMessages(items => items.some(item => item.id === message.id) ? items : [...items, message]);
      void refresh(socket.current).catch(() => {});
      setDraft(''); setSoundPickerOpen(false);
    } catch (reason) { setError(reason instanceof Error && reason.message === 'CHAT_RESTRICTED' ? t('chat.restricted') : t('chat.sendError')); } finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file || !socket.current) return;
    if (file.size > 5 * 1024 * 1024) return setError(t('chat.fileTooLarge'));
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : '';
    if (!kind) return setError(t('chat.invalidFile'));
    setBusy(true); setError('');
    try {
      const signed = await socket.current.request('mediaUpload', { kind, contentType: file.type, size: file.size });
      const response = await fetch(String(signed.uploadUrl), { method: 'PUT', headers: { 'content-type': file.type }, body: file });
      if (!response.ok) throw new Error();
      const result = await socket.current.request('send', { conversation: active, kind, key: signed.key });
      const message = result.message as ChatMessage;
      stickToBottom.current = true;
      setMessages(items => items.some(item => item.id === message.id) ? items : [...items, message]);
      void refresh(socket.current).catch(() => {});
    } catch (reason) { setError(reason instanceof Error && reason.message === 'CHAT_RESTRICTED' ? t('chat.restricted') : t('chat.uploadError')); } finally { setBusy(false); }
  }
  async function report(event: FormEvent) {
    event.preventDefault();
    if (!socket.current) return;
    setBusy(true);
    try {
      await socket.current.request('report', { conversation: active, reason: reportReason });
      setReportOpen(false); setReportReason(''); setError(t('chat.reportSent'));
    } catch { setError(t('chat.reportError')); } finally { setBusy(false); }
  }
  async function enableNotifications() {
    if (!socket.current || !user || status !== 'ready' || pushBusy) return;
    setPushBusy(true); setError('');
    try {
      await enableChatPush(socket.current, locale, user.id);
      setPushEnabled(true);
      setError(t('chat.notificationsEnabled'));
    } catch (reason) {
      const key = reason instanceof Error && reason.message === 'not-configured' ? 'chat.notificationsNotConfigured' : 'chat.pushError';
      setError(t(key));
    } finally { setPushBusy(false); }
  }
  const current = conversations.find(item => item.id === active);
  const title = (item: ChatConversation) => item.group ? item.title : item.members.filter(id => id !== user?.id).map(id => item.names?.[id] ?? id).join(', ');
  const returnToInbox = () => {
    activeRef.current = '';
    setActive('');
    setMessages([]);
    setLoadingHistoryFor('');
    setHistoryCursor(null);
    stickToBottom.current = true;
    setSoundPickerOpen(false);
    setReactionPickerMessageKey('');
    if (reactionToolbarTimer.current) clearTimeout(reactionToolbarTimer.current);
    setReactionToolbarMessageKey('');
    setReactionToolbarClosing(false);
    setRevealedReactionMessageKey('');
    setMembersOpen(false);
  };
  if (!ready) return <div className="page chat-gate"><LoadingIndicator label={t('common.loading')} /></div>;
  if (!user) return <div className="page chat-gate"><MessageCircle size={36}/><h1>{t('chat.title')}</h1><p>{params.get('invite') ? t('chat.inviteSignIn') : t('chat.signInHint')}</p><button className="button dark" onClick={() => void signInWithGoogle(`/chat/${params.toString() ? `?${params.toString()}` : ''}`)}>{t('profile.googleSignIn')}</button></div>;
  if (!wsUrl) return <div className="page chat-gate"><h1>{t('chat.title')}</h1><p>{t('chat.notConfigured')}</p></div>;
  return <div className="page chat-page">
    {error && <p className="chat-notice" role="status">{error}<button onClick={() => setError('')} aria-label={t('chat.dismiss')}><X size={15}/></button></p>}
    {status !== 'ready' && <p className="chat-notice" role="status">{t(status === 'connecting' ? 'chat.connecting' : 'chat.connectionError')}</p>}
    <div className={`chat-layout ${current ? 'chat-show-thread' : 'chat-show-inbox'}`}><aside className="chat-inbox"><div className="chat-inbox-header"><h2>{t('chat.inbox')}</h2><button type="button" className="chat-icon" onClick={() => void enableNotifications()} disabled={pushBusy || pushEnabled || status !== 'ready'} aria-label={t(pushEnabled ? 'chat.notificationsEnabled' : 'chat.enableNotifications')} title={t(pushEnabled ? 'chat.notificationsEnabled' : 'chat.enableNotifications')}><Bell size={17}/></button></div>
      <div className="chat-search"><Search size={17}/><input value={query} onChange={event => { setQuery(event.target.value); setMatches([]); setSearchLoading(event.target.value.trim().length >= 2); }} placeholder={t('chat.searchUsername')} aria-label={t('chat.searchUsername')}/></div>
      {searchLoading && <div className="chat-search-loading"><LoadingIndicator label={t('common.loading')} /></div>}
      {matches.length > 0 && <div className="chat-results">{matches.map(player => <button key={player.id} onClick={() => { setSelected(items => items.some(item => item.id === player.id) ? items : [...items, player]); setQuery(''); setMatches([]); setSearchLoading(false); }}>{player.username}<Plus size={15}/></button>)}</div>}
      {selected.length > 0 && <div className="chat-compose-group"><div className="chat-selected">{selected.map(player => <button key={player.id} onClick={() => setSelected(items => items.filter(item => item.id !== player.id))}>{player.username}<X size={13}/></button>)}</div><label><input type="checkbox" checked={group} onChange={event => setGroup(event.target.checked)}/>{t('chat.groupChat')}</label>{group && <input value={groupTitle} maxLength={80} onChange={event => setGroupTitle(event.target.value)} placeholder={t('chat.groupName')}/>}<button className="button dark compact" disabled={busy || (group && !groupTitle.trim())} onClick={() => void createConversation()}>{busy && <LoadingIndicator label={t('common.loading')} compact/>}{group ? t('chat.createGroup') : t('chat.startChat')}</button></div>}
      <div className="chat-inbox-list">{!initialChatsLoaded && status !== 'unavailable' ? <div className="chat-loading-area"><LoadingIndicator label={t('common.loading')} /></div> : conversations.length ? conversations.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => { if (active !== item.id) { setMessages([]); setLoadingHistoryFor(item.id); setActive(item.id); } }}><span className="chat-avatar">{item.group ? <UsersRound size={19}/> : title(item).slice(0, 1).toUpperCase()}</span><span><strong>{title(item)}</strong><small>{item.lastMessage === 'sound' ? t('nav.soundboard') : item.lastMessage ?? t('chat.noMessages')}</small></span></button>) : <p className="chat-empty-inbox">{t('chat.emptyInbox')}</p>}</div>
    </aside><section className="chat-thread">{current ? <><header><button type="button" className="chat-back" onClick={returnToInbox} aria-label={t('chat.inbox')}><ArrowLeft size={19}/></button><span className="chat-avatar">{current.group ? <UsersRound size={19}/> : title(current).slice(0, 1).toUpperCase()}</span><div><h2>{title(current)}</h2><small>{current.group ? t('chat.memberCount', { count: current.members.length }) : t('chat.directMessage')}</small></div><div className="chat-header-actions">{current.group && <button className="chat-icon" onClick={() => { setMembersError(''); setMembersOpen(true); }} aria-label={t('chat.manageMembers')}><UsersRound size={18}/></button>}<button className="chat-icon" onClick={() => setReportOpen(true)} aria-label={t('chat.reportConversation')}><Flag size={18}/></button></div></header><div className="chat-messages" ref={messagePane} onScroll={event => { const pane = event.currentTarget; stickToBottom.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80; if (pane.scrollTop < 80) void loadOlderMessages(); }}>{loadingOlder && <div className="chat-older-loading"><LoadingIndicator label={t('chat.loadingOlder')} compact/></div>}{loadingHistoryFor === active ? <div className="chat-loading-area"><LoadingIndicator label={t('common.loading')} /></div> : messages.length ? messages.map(message => <article className={`chat-bubble ${message.senderId === user.id ? 'mine' : ''} ${reactionToolbarMessageKey === message.messageKey ? 'reaction-open' : ''} ${revealedReactionMessageKey === message.messageKey ? 'reaction-button-visible' : ''}`} key={message.id} data-reaction-message-key={message.messageKey} onPointerDown={event => handleMessagePointerDown(event, message.messageKey)} onPointerMove={handleMessagePointerMove} onPointerUp={clearReactionHold} onPointerCancel={clearReactionHold} onClick={event => handleMessageClick(event, message.messageKey)} onContextMenu={event => { if (Capacitor.isNativePlatform() && message.messageKey && !isMessageControl(event.target)) { event.preventDefault(); setRevealedReactionMessageKey(message.messageKey); } }}>{current.group && <small>{current.names?.[message.senderId] ?? (message.senderId === user.id ? user.name : message.senderId)}</small>}{message.kind === 'image' || message.kind === 'gif' ? <img src={message.kind === 'gif' ? message.text : message.url} alt={t(message.kind === 'gif' ? 'chat.gif' : 'chat.image')}/> : message.kind === 'video' ? <video src={message.url} controls playsInline/> : message.kind === 'sound' ? <ChatSoundCard soundId={message.text}/> : <p>{message.text}</p>}{message.messageKey && <ChatReactions message={message} userId={user.id} disabled={reactingMessageKey === message.messageKey} open={reactionToolbarMessageKey === message.messageKey} closing={reactionToolbarClosing} onReact={emoji => { void reactToMessage(message.messageKey!, emoji); }} onToggle={() => toggleReactionToolbar(message.messageKey!)} onClose={closeReactionToolbar} onOpenPicker={() => { closeReactionToolbar(); setReactionPickerMessageKey(message.messageKey!); }} />}<footer><time>{new Date(message.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time></footer></article>) : <p className="chat-empty-thread">{t('chat.emptyThread')}</p>}</div><form className="chat-composer" onSubmit={event => { event.preventDefault(); void send('text', draft); }}><label className="chat-icon" aria-label={t('chat.attach')}><ImagePlus size={19}/><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }}/></label><button type="button" className="chat-icon chat-sound-toggle" onClick={() => setSoundPickerOpen(value => !value)} aria-label={t('chat.shareSound')} aria-expanded={soundPickerOpen} aria-controls="chat-sound-picker"><AudioLines size={19}/></button><input value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} placeholder={t('chat.messagePlaceholder')} aria-label={t('chat.messagePlaceholder')}/><button className="chat-send" disabled={busy || !draft.trim()} aria-label={t('chat.send')}>{busy ? <LoadingIndicator label={t('common.loading')} compact/> : <Send size={18}/>}</button></form>{soundPickerOpen && <ChatSoundPicker busy={busy} onClose={() => setSoundPickerOpen(false)} onSend={id => { void send('sound', id); }}/>}</> : <div className="chat-welcome"><MessageCircle size={34}/><h2>{t('chat.selectConversation')}</h2><p>{t('chat.selectHint')}</p></div>}</section></div>
    {membersOpen && current?.group && <ChatGroupMembers conversation={current} userId={user.id} busy={membersBusy} sharing={sharing} actionError={membersError} getIdToken={getIdToken} onAdd={player => { void updateGroupMember(current.id, player, true); }} onRemove={id => { void updateGroupMember(current.id, { id, username: current.names?.[id] ?? id }, false); }} onShare={() => { void shareGroup(current.id); }} onClose={() => setMembersOpen(false)} />}
    {shareUrl && <ChatShareDialog url={shareUrl} group onClose={() => setShareUrl('')}/>}
    {(inviteLoading || inviteDetails || inviteError) && <div className="chat-modal-backdrop" role="presentation"><section className="chat-modal chat-invite-modal" role="dialog" aria-modal="true" aria-label={t('chat.inviteTitle')}><button type="button" className="chat-icon" onClick={dismissInvite} aria-label={t('chat.dismiss')}><X size={18}/></button><UsersRound size={27}/><h2>{t('chat.inviteTitle')}</h2>{inviteLoading ? <LoadingIndicator label={t('common.loading')}/> : inviteDetails ? <><h3>{inviteDetails.title}</h3><p>{t('chat.inviteMembers', { count: inviteDetails.memberCount })}</p>{inviteError && <p className="form-error" role="alert">{inviteError}</p>}<div className="chat-invite-actions"><button type="button" className="button secondary" onClick={dismissInvite}>{t('chat.declineInvite')}</button><button type="button" className="button dark" disabled={inviteBusy} onClick={() => void acceptInvite()}>{inviteBusy && <LoadingIndicator label={t('common.loading')} compact/>}{t(inviteDetails.alreadyMember ? 'chat.openGroup' : 'chat.acceptInvite')}</button></div></> : <><p className="form-error" role="alert">{inviteError}</p><button type="button" className="button secondary" onClick={dismissInvite}>{t('chat.dismiss')}</button></>}</section></div>}
    {reportOpen && <div className="chat-modal-backdrop" role="presentation"><form className="chat-modal" onSubmit={report} role="dialog" aria-modal="true" aria-label={t('chat.reportTitle')}><button type="button" className="chat-icon" onClick={() => setReportOpen(false)} aria-label={t('chat.dismiss')}><X size={18}/></button><Flag size={23}/><h2>{t('chat.reportTitle')}</h2><p>{t('chat.reportHint')}</p><textarea value={reportReason} onChange={event => setReportReason(event.target.value)} minLength={3} maxLength={500} required placeholder={t('chat.reportPlaceholder')}/><button className="button dark" disabled={busy}>{busy && <LoadingIndicator label={t('common.loading')} compact/>}{t('chat.submitReport')}</button></form></div>}
    {reactionPickerMessageKey && <Suspense fallback={<div className="chat-modal-backdrop"><LoadingIndicator label={t('common.loading')}/></div>}><ChatEmojiPicker onClose={() => setReactionPickerMessageKey('')} onSelect={emoji => { void reactToMessage(reactionPickerMessageKey, emoji); }}/></Suspense>}
  </div>;
}
