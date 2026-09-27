'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioLines, Play, Search, Send, Square, X } from 'lucide-react';
import { useApp } from './app-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';

export function ChatSoundCard({ soundId }: { soundId: string }) {
  const { t } = useI18n();
  const { play, playing, loadingSounds, sounds, soundCatalogStatus, ensureSoundLoaded } = useApp();
  const sound = sounds.find(item => item.id === soundId);
  useEffect(() => {
    if (!sound && soundCatalogStatus === 'ready') ensureSoundLoaded(soundId);
  }, [ensureSoundLoaded, sound, soundCatalogStatus, soundId]);
  if (!sound) return <span className="chat-sound-card"><AudioLines size={20}/>{t('nav.soundboard')}</span>;
  const active = playing.includes(sound.id);
  const loading = loadingSounds.includes(sound.id);
  return <button type="button" className="chat-sound-card" onClick={() => play(sound)} aria-label={`${t(loading ? 'common.loading' : active ? 'common.stop' : 'common.play')} ${sound.name}`} aria-busy={loading}><span className="chat-sound-card-icon"><AudioLines size={20}/></span><span><small>{t('nav.soundboard')}</small><strong>{sound.name}</strong></span>{loading ? <LoadingIndicator label={t('common.loading')} compact/> : active ? <Square size={17}/> : <Play size={17}/>}</button>;
}

export function ChatSoundPicker({ busy, open, onClose, onSend }: { busy: boolean; open: boolean; onClose: () => void; onSend: (id: string) => void }) {
  const { t } = useI18n();
  const { play, playing, loadingSounds, sounds, soundCatalogStatus, soundCatalogHasMore, soundCatalogLoadingMore, soundCatalogMoreError, loadMoreSounds, refreshSoundCatalog } = useApp();
  const [query, setQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const soundListRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const filtered = sounds.filter(sound => sound.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) {
        if (event.target instanceof Element && event.target.closest('.chat-sound-toggle')) return;
        onClose();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open, onClose]);

  useEffect(() => {
    const root = soundListRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!open || soundCatalogStatus !== 'ready' || !soundCatalogHasMore || soundCatalogLoadingMore || soundCatalogMoreError || !root || !sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        void loadMoreSounds();
      }
    }, { root, rootMargin: '100px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filtered.length, loadMoreSounds, open, query, soundCatalogHasMore, soundCatalogLoadingMore, soundCatalogMoreError, soundCatalogStatus]);

  useEffect(() => {
    soundListRef.current?.scrollTo({ top: 0 });
  }, [open, query]);

  return <div ref={pickerRef} className="chat-sound-picker" id="chat-sound-picker" role="dialog" aria-label={t('nav.soundboard')} aria-hidden={!open} data-open={open} inert={!open}>
    <div className="chat-sound-picker-header"><strong><AudioLines size={18}/>{t('nav.soundboard')}</strong><button type="button" className="chat-icon" onClick={() => { setQuery(''); onClose(); }} aria-label={t('chat.dismiss')}><X size={17}/></button></div>
    <label className="chat-sound-search"><Search size={16}/><input value={query} onChange={event => { setQuery(event.target.value); soundListRef.current?.scrollTo({ top: 0 }); }} placeholder={t('sounds.searchPlaceholder')} aria-label={t('sounds.searchLabel')}/></label>
    <div className="chat-sound-list" ref={soundListRef}>{soundCatalogStatus === 'loading' ? <p className="chat-sound-empty">{t('sounds.loadingCatalog')}</p> : soundCatalogStatus === 'error' ? <div className="chat-sound-empty"><p>{t('sounds.catalogUnavailable')}</p><button type="button" onClick={refreshSoundCatalog}>{t('sounds.retryCatalog')}</button></div> : filtered.length || soundCatalogHasMore ? <>{filtered.map(sound => { const active = playing.includes(sound.id); const loading = loadingSounds.includes(sound.id); return <div className="chat-sound-row" key={sound.id}><button type="button" className="chat-sound-preview" onClick={() => play(sound)} aria-label={`${t(loading ? 'common.loading' : active ? 'common.stop' : 'common.play')} ${sound.name}`} aria-busy={loading}>{loading ? <LoadingIndicator label={t('common.loading')} compact/> : active ? <Square size={15}/> : <Play size={15}/>}</button><span>{sound.name}</span><button type="button" className="chat-sound-send" disabled={busy} onClick={() => { setQuery(''); onSend(sound.id); }} aria-label={t('chat.sendSound', { name: sound.name })}><Send size={16}/></button></div>; })}{soundCatalogHasMore && <div ref={loadMoreSentinelRef} className="chat-sound-load-more-sentinel">{soundCatalogLoadingMore && <LoadingIndicator label={t('common.loading')} compact/>}{soundCatalogMoreError && <button type="button" onClick={() => { void loadMoreSounds(); }}>{t('sounds.retryCatalog')}</button>}</div>}</> : <p className="chat-sound-empty">{sounds.length ? t('sounds.none') : t('sounds.noPublishedSounds')}</p>}</div>
  </div>;
}
