'use client';

import { useState } from 'react';
import { AudioLines, Play, Search, Send, Square, X } from 'lucide-react';
import { sounds } from '@/lib/catalog';
import { useApp } from './app-provider';
import { useI18n } from './i18n-provider';

export function ChatSoundCard({ soundId }: { soundId: string }) {
  const { t } = useI18n();
  const { play, playing } = useApp();
  const sound = sounds.find(item => item.id === soundId);
  if (!sound) return <span className="chat-sound-card"><AudioLines size={20}/>{t('nav.soundboard')}</span>;
  const active = playing.includes(sound.id);
  return <button type="button" className="chat-sound-card" onClick={() => play(sound)} aria-label={`${t(active ? 'common.stop' : 'common.play')} ${sound.name}`}><span className="chat-sound-card-icon"><AudioLines size={20}/></span><span><small>{t('nav.soundboard')}</small><strong>{sound.name}</strong></span>{active ? <Square size={17}/> : <Play size={17}/>}</button>;
}

export function ChatSoundPicker({ busy, onClose, onSend }: { busy: boolean; onClose: () => void; onSend: (id: string) => void }) {
  const { t } = useI18n();
  const { play, playing } = useApp();
  const [query, setQuery] = useState('');
  const filtered = sounds.filter(sound => sound.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="chat-sound-picker" id="chat-sound-picker" role="dialog" aria-label={t('nav.soundboard')}>
    <div className="chat-sound-picker-header"><strong><AudioLines size={18}/>{t('nav.soundboard')}</strong><button type="button" className="chat-icon" onClick={onClose} aria-label={t('chat.dismiss')}><X size={17}/></button></div>
    <label className="chat-sound-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('sounds.searchPlaceholder')} aria-label={t('sounds.searchLabel')}/></label>
    <div className="chat-sound-list">{filtered.length ? filtered.map(sound => <div className="chat-sound-row" key={sound.id}><button type="button" className="chat-sound-preview" onClick={() => play(sound)} aria-label={`${t(playing.includes(sound.id) ? 'common.stop' : 'common.play')} ${sound.name}`}>{playing.includes(sound.id) ? <Square size={15}/> : <Play size={15}/>}</button><span>{sound.name}</span><button type="button" className="chat-sound-send" disabled={busy} onClick={() => onSend(sound.id)} aria-label={t('chat.sendSound', { name: sound.name })}><Send size={16}/></button></div>) : <p className="chat-sound-empty">{t('sounds.none')}</p>}</div>
  </div>;
}
