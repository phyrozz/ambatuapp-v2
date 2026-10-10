'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';

type ManagedVideo = { id: string; title: string; description: string };
const api = () => `${process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? ''}/videos`;

export function VideoManageDialog({ video, onClose, onSaved, onDeleted }: {
  video: ManagedVideo;
  onClose: () => void;
  onSaved: (updated: Pick<ManagedVideo, 'title' | 'description'>) => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const { getIdToken } = useAuth();
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Missing player token.');
      const response = await fetch(`${api()}/${encodeURIComponent(video.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, description }),
      });
      if (!response.ok) throw new Error('Video update failed.');
      const updated = await response.json() as Pick<ManagedVideo, 'title' | 'description'>;
      onSaved(updated);
    } catch {
      setError(t('watch.saveVideoError'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteVideo() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Missing player token.');
      const response = await fetch(`${api()}/${encodeURIComponent(video.id)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Video deletion failed.');
      onDeleted();
    } catch {
      setError(t('watch.deleteVideoError'));
    } finally {
      setBusy(false);
    }
  }

  return <div className="video-manage-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="video-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="video-manage-title">
      <button type="button" className="video-manage-close" aria-label={t('chat.dismiss')} disabled={busy} onClick={onClose}><X size={18}/></button>
      <h2 id="video-manage-title">{confirmingDelete ? t('watch.deleteVideoTitle') : t('watch.editVideoTitle')}</h2>
      {confirmingDelete ? <>
        <p>{t('watch.deleteVideoDescription')}</p>
        {error && <p className="video-manage-error" role="alert">{error}</p>}
        <div className="video-manage-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={() => { setConfirmingDelete(false); setError(''); }}>{t('chat.dismiss')}</button>
          <button type="button" className="button video-manage-confirm-delete" disabled={busy} onClick={() => void deleteVideo()}>{busy ? t('watch.deletingVideo') : t('watch.confirmDeleteVideo')}</button>
        </div>
      </> : <form className="video-manage-form" onSubmit={save}>
        <label>{t('watch.videoTitle')}<input value={title} maxLength={120} required onChange={event => setTitle(event.target.value)} /></label>
        <label>{t('watch.descriptionLabel')}<textarea value={description} maxLength={1000} onChange={event => setDescription(event.target.value)} /></label>
        {error && <p className="video-manage-error" role="alert">{error}</p>}
        <div className="video-manage-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>{t('chat.dismiss')}</button>
          <button type="submit" className="button dark" disabled={busy || !title.trim()}><Pencil size={15}/>{busy ? t('watch.savingChanges') : t('watch.saveChanges')}</button>
        </div>
        <button type="button" className="video-manage-delete" disabled={busy} onClick={() => { setConfirmingDelete(true); setError(''); }}><Trash2 size={15}/>{t('watch.deleteVideo')}</button>
      </form>}
    </section>
  </div>;
}
