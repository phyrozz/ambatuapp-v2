'use client';

import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Check, Copy, Share2 } from 'lucide-react';
import { useI18n } from './i18n-provider';
import './chat-share.css';

export function ClipShareLink({ title, url }: { title: string; url: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function share() {
    setSharing(true);
    setError(false);
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title, text: title, url, dialogTitle: t('chat.share') });
      } else if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await copy();
      }
    } catch (reason) {
      if (!Capacitor.isNativePlatform() && (reason as { name?: string })?.name !== 'AbortError') {
        await copy();
      }
    } finally {
      setSharing(false);
    }
  }

  return <section className="clip-share-link-panel" aria-label={t('chat.shareLink')}>
    <label className="chat-share-link">{t('chat.shareLink')}<input readOnly value={url} onFocus={event => event.target.select()} /></label>
    <div className="chat-share-actions">
      <button type="button" className="button secondary" onClick={() => void copy()}>{copied ? <Check size={17} /> : <Copy size={17} />}{t(copied ? 'chat.linkCopied' : 'chat.copyLink')}</button>
      <button type="button" className="button dark" disabled={sharing} onClick={() => void share()}><Share2 size={17}/>{t('chat.share')}</button>
    </div>
    {error && <p className="friends-error" role="alert">{t('chat.copyFailed')}</p>}
  </section>;
}
