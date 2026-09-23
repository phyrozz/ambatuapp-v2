'use client';
import './chat.css';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, AudioLines, Flag, ImagePlus, MessageCircle, Plus, Search, Send, UsersRound, X } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import { ChatSoundCard, ChatSoundPicker } from './chat-soundboard';
import { ChatSocket, type ChatConversation, type ChatMessage } from '@/lib/chat';

type Player = { id: string; username: string };
const wsUrl = process.env.NEXT_PUBLIC_CHAT_WS_URL;
const playersApi = `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/players`;

export function ChatPage() {
  const { t } = useI18n();
  const { ready, user, getAccessToken, getIdToken, signInWithGoogle } = useAuth();
  const params = useSearchParams();
  const [status, setStatus] = useState<'connecting' | 'ready' | 'unavailable'>('connecting');
  const [reconnect, setReconnect] = useState(0);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [initialChatsLoaded, setInitialChatsLoaded] = useState(false);
  const [active, setActive] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistoryFor, setLoadingHistoryFor] = useState('');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Player[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<Player[]>([]);
  const [group, setGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const socket = useRef<ChatSocket | null>(null);
  const activeRef = useRef('');
  const initialUser = useRef(false);
  const messagePane = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (client: ChatSocket) => {
    const data = await client.request('conversations');
    setConversations((data.conversations as ChatConversation[] ?? []).sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  useEffect(() => {
    if (!ready || !user || !wsUrl) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let client: ChatSocket;
    const run = async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      client = new ChatSocket();
      socket.current = client;
      client.onMessage = (message) => {
        if (message.conversationId === activeRef.current) setMessages(items => items.some(item => item.id === message.id) ? items : [...items, message]);
        void refresh(client).catch(() => {});
      };
      client.onConversation = () => { void refresh(client).catch(() => {}); };
      client.onClose = () => { if (!cancelled) { setStatus('unavailable'); retryTimer = setTimeout(() => setReconnect(value => value + 1), 2000); } };
      try {
        await client.connect(wsUrl, token);
        if (cancelled) return client.close();
        setStatus('ready');
        await refresh(client);
        if (!cancelled) setInitialChatsLoaded(true);
        const target = params.get('user');
        if (target && target !== user.id && !initialUser.current) {
          initialUser.current = true;
          const name = params.get('name') ?? target;
          const data = await client.request('createConversation', { members: [target], names: { [target]: name, [user.id]: user.name } });
          const id = String(data.conversation);
          setLoadingHistoryFor(id);
          activeRef.current = id;
          setActive(id);
          await refresh(client);
        }
      } catch { if (!cancelled) { setStatus('unavailable'); setError(t('chat.connectionError')); } }
    };
    void run();
    return () => { cancelled = true; clearTimeout(retryTimer); client?.close(); socket.current = null; };
  }, [ready, user, getAccessToken, params, refresh, reconnect, t]);

  useEffect(() => {
    if (!active || !socket.current) return;
    activeRef.current = active;
    let cancelled = false;
    socket.current.request('history', { conversation: active }).then(data => { if (!cancelled) setMessages(data.messages as ChatMessage[] ?? []); }).catch(() => { if (!cancelled) setError(t('chat.historyError')); }).finally(() => { if (!cancelled) setLoadingHistoryFor(''); });
    return () => { cancelled = true; };
  }, [active, t]);
  useEffect(() => {
    if (messagePane.current) messagePane.current.scrollTop = messagePane.current.scrollHeight;
  }, [messages]);
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
  async function send(kind: ChatMessage['kind'], text = '', key = '') {
    if (!socket.current || !active) return;
    setBusy(true); setError('');
    try {
      const result = await socket.current.request('send', { conversation: active, kind, text, key });
      const message = result.message as ChatMessage;
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
      setMessages(items => items.some(item => item.id === message.id) ? items : [...items, message]);
      void refresh(socket.current).catch(() => {});
    } catch (reason) { setError(reason instanceof Error && reason.message === 'CHAT_RESTRICTED' ? t('chat.restricted') : t('chat.uploadError')); } finally { setBusy(false); }
  }
  async function report(event: FormEvent) {
    event.preventDefault();
    if (!socket.current) return;
    setBusy(true);
    try {
      await socket.current.request('report', { conversation: active, messageId: reportMessage, reason: reportReason });
      setReportOpen(false); setReportReason(''); setReportMessage(''); setError(t('chat.reportSent'));
    } catch { setError(t('chat.reportError')); } finally { setBusy(false); }
  }
  const current = conversations.find(item => item.id === active);
  const title = (item: ChatConversation) => item.group ? item.title : item.members.filter(id => id !== user?.id).map(id => item.names?.[id] ?? id).join(', ');
  const returnToInbox = () => {
    activeRef.current = '';
    setActive('');
    setMessages([]);
    setLoadingHistoryFor('');
    setSoundPickerOpen(false);
  };
  if (!ready) return <div className="page chat-gate"><LoadingIndicator label={t('common.loading')} /></div>;
  if (!user) return <div className="page chat-gate"><MessageCircle size={36}/><h1>{t('chat.title')}</h1><p>{t('chat.signInHint')}</p><button className="button dark" onClick={() => void signInWithGoogle('/chat/')}>{t('profile.googleSignIn')}</button></div>;
  if (!wsUrl) return <div className="page chat-gate"><h1>{t('chat.title')}</h1><p>{t('chat.notConfigured')}</p></div>;
  return <div className="page chat-page">
    {error && <p className="chat-notice" role="status">{error}<button onClick={() => setError('')} aria-label={t('chat.dismiss')}><X size={15}/></button></p>}
    {status !== 'ready' && <p className="chat-notice" role="status">{t(status === 'connecting' ? 'chat.connecting' : 'chat.connectionError')}</p>}
    <div className={`chat-layout ${current ? 'chat-show-thread' : 'chat-show-inbox'}`}><aside className="chat-inbox"><div className="chat-inbox-header"><h2>{t('chat.inbox')}</h2><button className="chat-icon" onClick={() => { setGroup(true); returnToInbox(); }} aria-label={t('chat.newGroup')}><Plus size={18}/></button></div>
      <div className="chat-search"><Search size={17}/><input value={query} onChange={event => { setQuery(event.target.value); setMatches([]); setSearchLoading(event.target.value.trim().length >= 2); }} placeholder={t('chat.searchUsername')} aria-label={t('chat.searchUsername')}/></div>
      {searchLoading && <div className="chat-search-loading"><LoadingIndicator label={t('common.loading')} /></div>}
      {matches.length > 0 && <div className="chat-results">{matches.map(player => <button key={player.id} onClick={() => { setSelected(items => items.some(item => item.id === player.id) ? items : [...items, player]); setQuery(''); setMatches([]); setSearchLoading(false); }}>{player.username}<Plus size={15}/></button>)}</div>}
      {selected.length > 0 && <div className="chat-compose-group"><div className="chat-selected">{selected.map(player => <button key={player.id} onClick={() => setSelected(items => items.filter(item => item.id !== player.id))}>{player.username}<X size={13}/></button>)}</div><label><input type="checkbox" checked={group} onChange={event => setGroup(event.target.checked)}/>{t('chat.groupChat')}</label>{group && <input value={groupTitle} maxLength={80} onChange={event => setGroupTitle(event.target.value)} placeholder={t('chat.groupName')}/>}<button className="button dark compact" disabled={busy || (group && !groupTitle.trim())} onClick={() => void createConversation()}>{busy && <LoadingIndicator label={t('common.loading')} compact/>}{group ? t('chat.createGroup') : t('chat.startChat')}</button></div>}
      <div className="chat-inbox-list">{!initialChatsLoaded && status !== 'unavailable' ? <div className="chat-loading-area"><LoadingIndicator label={t('common.loading')} /></div> : conversations.length ? conversations.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => { if (active !== item.id) { setMessages([]); setLoadingHistoryFor(item.id); setActive(item.id); } }}><span className="chat-avatar">{item.group ? <UsersRound size={19}/> : title(item).slice(0, 1).toUpperCase()}</span><span><strong>{title(item)}</strong><small>{item.lastMessage === 'sound' ? t('nav.soundboard') : item.lastMessage ?? t('chat.noMessages')}</small></span></button>) : <p className="chat-empty-inbox">{t('chat.emptyInbox')}</p>}</div>
    </aside><section className="chat-thread">{current ? <><header><button type="button" className="chat-back" onClick={returnToInbox} aria-label={t('chat.inbox')}><ArrowLeft size={19}/></button><span className="chat-avatar">{current.group ? <UsersRound size={19}/> : title(current).slice(0, 1).toUpperCase()}</span><div><h2>{title(current)}</h2><small>{current.group ? t('chat.memberCount', { count: current.members.length }) : t('chat.directMessage')}</small></div><button className="chat-icon" onClick={() => { setReportMessage(''); setReportOpen(true); }} aria-label={t('chat.reportConversation')}><Flag size={18}/></button></header><div className="chat-messages" ref={messagePane}>{loadingHistoryFor === active ? <div className="chat-loading-area"><LoadingIndicator label={t('common.loading')} /></div> : messages.length ? messages.map(message => <article className={`chat-bubble ${message.senderId === user.id ? 'mine' : ''}`} key={message.id}><small>{current.names?.[message.senderId] ?? (message.senderId === user.id ? user.name : message.senderId)}</small>{message.kind === 'image' || message.kind === 'gif' ? <img src={message.kind === 'gif' ? message.text : message.url} alt={t(message.kind === 'gif' ? 'chat.gif' : 'chat.image')}/> : message.kind === 'video' ? <video src={message.url} controls playsInline/> : message.kind === 'sound' ? <ChatSoundCard soundId={message.text}/> : <p>{message.text}</p>}<footer><time>{new Date(message.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>{message.senderId !== user.id && <button onClick={() => { setReportMessage(message.id); setReportOpen(true); }} aria-label={t('chat.reportMessage')}><Flag size={13}/></button>}</footer></article>) : <p className="chat-empty-thread">{t('chat.emptyThread')}</p>}</div><form className="chat-composer" onSubmit={event => { event.preventDefault(); void send('text', draft); }}><label className="chat-icon" aria-label={t('chat.attach')}><ImagePlus size={19}/><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }}/></label><button type="button" className="chat-icon chat-sound-toggle" onClick={() => setSoundPickerOpen(value => !value)} aria-label={t('chat.shareSound')} aria-expanded={soundPickerOpen} aria-controls="chat-sound-picker"><AudioLines size={19}/></button><input value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} placeholder={t('chat.messagePlaceholder')} aria-label={t('chat.messagePlaceholder')}/><button className="chat-send" disabled={busy || !draft.trim()} aria-label={t('chat.send')}>{busy ? <LoadingIndicator label={t('common.loading')} compact/> : <Send size={18}/>}</button></form>{soundPickerOpen && <ChatSoundPicker busy={busy} onClose={() => setSoundPickerOpen(false)} onSend={id => { void send('sound', id); }}/>}</> : <div className="chat-welcome"><MessageCircle size={34}/><h2>{t('chat.selectConversation')}</h2><p>{t('chat.selectHint')}</p></div>}</section></div>
    {reportOpen && <div className="chat-modal-backdrop" role="presentation"><form className="chat-modal" onSubmit={report} role="dialog" aria-modal="true" aria-label={t('chat.reportTitle')}><button type="button" className="chat-icon" onClick={() => setReportOpen(false)} aria-label={t('chat.dismiss')}><X size={18}/></button><Flag size={23}/><h2>{t('chat.reportTitle')}</h2><p>{t('chat.reportHint')}</p><textarea value={reportReason} onChange={event => setReportReason(event.target.value)} minLength={3} maxLength={500} required placeholder={t('chat.reportPlaceholder')}/><button className="button dark" disabled={busy}>{busy && <LoadingIndicator label={t('common.loading')} compact/>}{t('chat.submitReport')}</button></form></div>}
  </div>;
}
