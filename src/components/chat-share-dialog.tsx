'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Share2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from './i18n-provider';
import { publicAppUrl } from '@/lib/share-links';
import { FriendsDialog } from './friends-dialog';
import './chat.css';
import './chat-share.css';

export function publicChatUrl(query: Record<string, string>) {
  return publicAppUrl('/chat/', query);
}

export function ChatShareDialog({ url, group, friend, onClose }: { url: string; group?: boolean; friend?: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setError(false); }
    catch { setError(true); }
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ url });
      else await copy();
    } catch { /* The native share sheet was dismissed. */ }
  }
  const contents = <>
      <div className="chat-share-qr" role="img" aria-label={t('chat.shareQr')}><QRCodeSVG value={url} size={208} marginSize={1} /></div>
      <label className="chat-share-link">{t('chat.shareLink')}<input readOnly value={url} onFocus={event => event.target.select()} /></label>
      {group && <small>{t('chat.inviteExpiry')}</small>}
      {error && <p className="form-error" role="alert">{t('chat.copyFailed')}</p>}
      <div className="chat-share-actions"><button type="button" className="button secondary" onClick={() => void copy()}>{copied ? <Check size={17}/> : <Copy size={17}/>}{t(copied ? 'chat.linkCopied' : 'chat.copyLink')}</button><button type="button" className="button dark" onClick={() => void share()}><Share2 size={17}/>{t('chat.share')}</button></div>
  </>;
  if (friend) return <FriendsDialog title={t('friends.shareLink')} description={t('friends.shareHint')} onClose={onClose}>{contents}</FriendsDialog>;
  const dialog = <div className="chat-modal-backdrop chat-share-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="chat-modal chat-share-dialog" role="dialog" aria-modal="true" aria-label={t(group ? 'chat.shareGroup' : 'profile.shareProfile')}>
      <button type="button" className="chat-icon" onClick={onClose} aria-label={t('chat.dismiss')}><X size={18}/></button>
      <h2>{t(group ? 'chat.shareGroup' : 'profile.shareProfile')}</h2>
      <p>{t(group ? 'chat.groupShareHint' : 'profile.shareHint')}</p>
      {contents}
    </section>
  </div>;
  return typeof document === 'undefined' ? null : createPortal(dialog, document.body);
}
