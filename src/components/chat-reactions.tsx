'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, SmilePlus } from 'lucide-react';
import type { ChatMessage } from '@/lib/chat';
import { useI18n } from './i18n-provider';

const quickEmoji = ['❤️', '😂', '👍', '😮', '😢'];

export function ChatReactions({ message, userId, disabled, open, closing, onReact, onToggle, onClose, onOpenPicker }: {
  message: ChatMessage;
  userId: string;
  disabled: boolean;
  open: boolean;
  closing: boolean;
  onReact: (emoji: string) => void;
  onToggle: () => void;
  onClose: () => void;
  onOpenPicker: () => void;
}) {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const choiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chosen, setChosen] = useState('');
  const reactions = message.reactions ?? {};
  const counts = new Map<string, number>();
  for (const emoji of Object.values(reactions)) counts.set(emoji, (counts.get(emoji) ?? 0) + 1);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open || closing) return;
    const pointerDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onCloseRef.current(); };
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('pointerdown', pointerDown);
    document.addEventListener('keydown', keyDown);
    const pane = popup.current?.closest('.chat-messages');
    if (pane && popup.current) {
      const overflow = popup.current.getBoundingClientRect().bottom - pane.getBoundingClientRect().bottom;
      if (overflow > 0) pane.scrollBy({ top: overflow + 10, behavior: 'smooth' });
    }
    return () => { document.removeEventListener('pointerdown', pointerDown); document.removeEventListener('keydown', keyDown); };
  }, [open, closing]);
  useEffect(() => () => { if (choiceTimer.current) clearTimeout(choiceTimer.current); }, []);

  const choose = (emoji: string) => {
    if (disabled || chosen) return;
    setChosen(emoji);
    choiceTimer.current = setTimeout(() => { onReact(emoji); setChosen(''); }, 150);
  };

  return <div className={`chat-reactions ${counts.size ? 'has-counts' : ''}`} ref={root}>
    <div className="chat-reaction-summary">
      {counts.size > 0 && <div className="chat-reaction-counts">{[...counts].map(([emoji, count]) => <button key={emoji} type="button" className={`${reactions[userId] === emoji ? 'selected' : ''} ${chosen === emoji ? 'chosen' : ''}`} disabled={disabled} onClick={() => choose(emoji)} aria-label={t('chat.reactionCount', { emoji, count })}>{emoji}<span>{count}</span></button>)}</div>}
      <button type="button" className={`chat-reaction-add ${open && !closing ? 'active' : ''}`} disabled={disabled} onClick={onToggle} aria-label={t('chat.addReaction')} aria-expanded={open && !closing} title={t('chat.addReaction')}><SmilePlus size={16}/></button>
    </div>
    {open && <div ref={popup} className="chat-reaction-popup" data-closing={closing || undefined} role="group" aria-label={t('chat.chooseReaction')}>
      {quickEmoji.map(emoji => <button key={emoji} type="button" className={`${reactions[userId] === emoji ? 'selected' : ''} ${chosen === emoji ? 'chosen' : ''}`} disabled={disabled || Boolean(chosen)} onClick={() => choose(emoji)} aria-label={t('chat.reactWith', { emoji })}>{emoji}</button>)}
      <button type="button" className="chat-reaction-more" disabled={disabled || Boolean(chosen)} onClick={onOpenPicker} aria-label={t('chat.moreReactions')}><Plus size={16}/></button>
    </div>}
  </div>;
}
