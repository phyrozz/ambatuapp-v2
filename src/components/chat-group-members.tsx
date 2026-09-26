'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Share2, UserMinus, UsersRound, X } from 'lucide-react';
import type { ChatConversation } from '@/lib/chat';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';

type Player = { id: string; username: string };
const playersApi = `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/players`;

export function ChatGroupMembers({ conversation, userId, busy, sharing, actionError, getIdToken, onAdd, onRemove, onShare, onClose }: {
  conversation: ChatConversation;
  userId: string;
  busy: boolean;
  sharing: boolean;
  actionError: string;
  getIdToken: () => Promise<string | null>;
  onAdd: (player: Player) => void;
  onRemove: (userId: string) => void;
  onShare: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const full = conversation.members.length >= 25;

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2 || full) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const token = await getIdToken();
        if (!token) throw new Error('token');
        const response = await fetch(`${playersApi}?q=${encodeURIComponent(search)}`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) throw new Error('search');
        const data = await response.json() as { players?: Player[] };
        setMatches((data.players ?? []).filter(player => !conversation.members.includes(player.id)));
      } catch { if (!controller.signal.aborted) setError(t('chat.searchError')); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, full, getIdToken, conversation.members, t]);

  return <div className="chat-modal-backdrop chat-member-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="chat-modal chat-member-modal" role="dialog" aria-modal="true" aria-label={t('chat.manageMembers')}>
      <header><h2><UsersRound size={21}/>{t('chat.manageMembers')}</h2><button type="button" className="chat-icon" onClick={onClose} aria-label={t('chat.dismiss')}><X size={18}/></button></header>
      <button type="button" className="button secondary chat-group-share" disabled={sharing} onClick={onShare}><Share2 size={17}/>{t('chat.shareGroup')}</button>
      {!full ? <>
        <div className="chat-search chat-member-search"><Search size={17}/><input value={query} onChange={event => { setQuery(event.target.value); setMatches([]); setLoading(event.target.value.trim().length >= 2); setError(''); }} placeholder={t('chat.searchUsername')} aria-label={t('chat.searchUsername')}/></div>
        {loading && <LoadingIndicator label={t('common.loading')} compact/>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {matches.length > 0 && <div className="chat-member-results">{matches.map(player => <button type="button" key={player.id} disabled={busy} onClick={() => onAdd(player)} aria-label={t('chat.addMember', { name: player.username })}><span>{player.username}</span><Plus size={16}/></button>)}</div>}
        {query.trim().length >= 2 && !loading && !error && matches.length === 0 && <p className="chat-member-empty">{t('chat.noUsersFound')}</p>}
      </> : <p className="chat-member-limit">{t('chat.memberLimit')}</p>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      <div className="chat-member-list">{conversation.members.map(id => <div className="chat-member-row" key={id}><span className="chat-avatar">{(conversation.names?.[id] ?? id).slice(0, 1).toUpperCase()}</span><strong>{conversation.names?.[id] ?? id}</strong><button type="button" className="chat-member-remove" disabled={busy} onClick={() => onRemove(id)} aria-label={id === userId ? t('chat.leaveGroup') : t('chat.removeMember', { name: conversation.names?.[id] ?? id })}><UserMinus size={17}/><span>{id === userId ? t('chat.leaveGroup') : t('chat.removeMember', { name: conversation.names?.[id] ?? id })}</span></button></div>)}</div>
    </section>
  </div>;
}
