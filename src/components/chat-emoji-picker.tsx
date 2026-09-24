'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import emojiCatalog from '@/data/emoji.json';
import { useI18n } from './i18n-provider';

export default function ChatEmojiPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (emoji: string) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(160);
  const [closing, setClosing] = useState(false);
  const [chosen, setChosen] = useState('');
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onCloseRef.current = onClose; onSelectRef.current = onSelect; }, [onClose, onSelect]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const choiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = setTimeout(() => onCloseRef.current(), 190);
  }, []);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', keyDown);
    return () => { document.removeEventListener('keydown', keyDown); if (closeTimer.current) clearTimeout(closeTimer.current); if (choiceTimer.current) clearTimeout(choiceTimer.current); };
  }, [requestClose]);
  const choose = (emoji: string) => {
    if (chosen || closing) return;
    setChosen(emoji);
    choiceTimer.current = setTimeout(() => { onSelectRef.current(emoji); requestClose(); }, 150);
  };
  const needle = query.trim().toLocaleLowerCase();
  const filtered = needle ? emojiCatalog.filter(item => item.name.toLocaleLowerCase().includes(needle) || item.emoji.includes(needle)) : emojiCatalog;
  return <div className="chat-modal-backdrop chat-emoji-backdrop" data-closing={closing || undefined} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
    <section className="chat-emoji-picker" role="dialog" aria-modal="true" aria-label={t('chat.chooseReaction')}>
      <header><h2>{t('chat.chooseReaction')}</h2><button type="button" className="chat-icon" onClick={requestClose} aria-label={t('chat.dismiss')}><X size={18}/></button></header>
      <label className="chat-emoji-search"><Search size={17}/><input value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(160); }} placeholder={t('chat.searchEmoji')} aria-label={t('chat.searchEmoji')} autoFocus/></label>
      <div className="chat-emoji-grid" onScroll={event => { const grid = event.currentTarget; if (grid.scrollHeight - grid.scrollTop - grid.clientHeight < 100) setVisibleCount(count => Math.min(count + 160, filtered.length)); }}>
        {filtered.slice(0, visibleCount).map(item => <button key={item.emoji} type="button" className={chosen === item.emoji ? 'chosen' : ''} disabled={Boolean(chosen) || closing} onClick={() => choose(item.emoji)} aria-label={t('chat.reactWith', { emoji: item.emoji })}>{item.emoji}</button>)}
        {!filtered.length && <p>{t('chat.noEmoji')}</p>}
      </div>
    </section>
  </div>;
}
