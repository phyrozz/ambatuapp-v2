'use client';

import { Download, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from './i18n-provider';

export function ChatImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    closeButton.current?.focus();
    return () => {
      if (element.open) element.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  async function download() {
    setDownloading(true);
    setError(false);
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error('download');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('download');
      const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ambatuchat-image.${extensions[blob.type] ?? 'image'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError(true);
    } finally {
      setDownloading(false);
    }
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="chat-image-preview"
      aria-label={t('chat.imagePreview')}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}
      onContextMenu={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
    >
      <div className="chat-image-preview-card">
        <div className="chat-image-preview-actions">
          <button type="button" className="chat-image-preview-button" aria-label={t('chat.downloadImage')} title={t('chat.downloadImage')} disabled={downloading} onClick={() => void download()}>
            <Download size={20} aria-hidden="true" />
          </button>
          <button ref={closeButton} type="button" className="chat-image-preview-button" aria-label={t('chat.closeImagePreview')} title={t('chat.closeImagePreview')} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="chat-image-preview-stage">
          <img src={src} alt={alt} />
        </div>
        {error && <p className="chat-image-preview-error" role="alert">{t('chat.imageDownloadError')}</p>}
      </div>
    </dialog>,
    document.body,
  );
}
