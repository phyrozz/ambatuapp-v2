'use client';

import { BookOpen, Music2, Pencil, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { useApp } from './app-provider';
import { CommunityUpload } from './community-upload';
import { LoadingIndicator } from './loading-indicator';
import { SoundPlayback } from './sound-playback';
import './community-upload.css';
import './my-contributions.css';

type LoreTranslation = { locale: string; label: string; title: string; text: string };
type ManagedLore = {
  kind: 'lore';
  status: 'Draft' | 'Published';
  id: string;
  title: string;
  text: string;
  tags: string[];
  translations: LoreTranslation[];
  imageKeys: string[];
  imageUrls: string[];
  createdAt: string | null;
};
type ManagedSound = {
  kind: 'sound';
  status: 'Draft' | 'Published';
  id: string;
  name: string;
  category: string;
  file: string;
  createdAt: string | null;
};
type ManagedItem = ManagedLore | ManagedSound;
type LoreImage = { key: string; url: string; local?: boolean };

const soundTypes = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/webm',
  'audio/aac',
]);

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ??
    `${window.location.origin}/api/public`;
  return `${base}/contributions/${path}`;
}

function errorText(
  error: unknown,
  t: (key: string) => string,
  fallback = 'profile.contributionSaveError',
) {
  if (error instanceof Error && error.message === '401') return t('contribute.sessionExpired');
  if (error instanceof Error && error.message === '429') return t('contribute.rateLimited');
  return t(fallback);
}

export function MyContributions({ kind, active }: { kind: 'lore' | 'sound'; active: boolean }) {
  const { t, locale } = useI18n();
  const { refreshSoundCatalog } = useApp();
  const { user, getIdToken } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<ManagedItem[]>([]);
  const [selected, setSelected] = useState<ManagedItem | null>(null);
  const [deleteOnOpen, setDeleteOnOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const loadNext = useRef<() => void>(() => {});

  useEffect(() => {
    if (!active || !userId) return;
    const controller = new AbortController();
    let cursor: string | null = null;
    let pending = false;
    let done = false;
    // Reset the list when its owner, tab, or explicit refresh changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    setError(false);
    setEnded(false);
    setNotice('');

    const next = async () => {
      if (pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError(false);
      try {
        const token = await getIdToken();
        if (!token) throw new Error('401');
        const query = new URLSearchParams({ limit: '20' });
        if (cursor) query.set('cursor', cursor);
        const response = await fetch(`${apiUrl(kind === 'lore' ? 'lores' : 'sounds')}?${query}`, {
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as {
          lores?: Omit<ManagedLore, 'kind'>[];
          sounds?: Omit<ManagedSound, 'kind'>[];
          nextCursor: string | null;
        };
        if (controller.signal.aborted) return;
        const batch: ManagedItem[] =
          kind === 'lore'
            ? (data.lores ?? []).map((item) => ({ ...item, kind: 'lore' as const }))
            : (data.sounds ?? []).map((item) => ({ ...item, kind: 'sound' as const }));
        setItems((previous) => [
          ...new Map([...previous, ...batch].map((item) => [item.id, item])).values(),
        ]);
        cursor = data.nextCursor;
        done = !cursor;
        setEnded(done);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadNext.current = () => void next();
    void next();
    return () => controller.abort();
  }, [active, getIdToken, kind, refreshKey, userId]);

  useEffect(() => {
    if (!active || !sentinel || loading || error || ended) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNext.current();
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [active, ended, error, items, loading, sentinel]);

  function updateItem(item: ManagedItem) {
    setItems((previous) => previous.map((current) => (current.id === item.id ? item : current)));
    setSelected(null);
    setNotice(t(item.status === 'Draft' ? 'contribute.draftSaved' : 'profile.contributionSaved'));
    if (item.kind === 'sound') refreshSoundCatalog();
  }

  function removeItem(id: string) {
    setItems((previous) => previous.filter((item) => item.id !== id));
    setSelected(null);
    setNotice(t('profile.contributionDeleted'));
    if (kind === 'sound') refreshSoundCatalog();
  }

  const headingKey = kind === 'lore' ? 'profile.loreUploads' : 'profile.soundUploads';
  const hintKey = 'contribute.manageHint';
  const emptyKey = kind === 'lore' ? 'profile.noLores' : 'profile.noSounds';
  const loadErrorKey = kind === 'lore' ? 'profile.loreLoadError' : 'profile.soundLoadError';

  return (
    <div className="my-contributions">
      <header className="my-contributions-heading">
        <div>
          <p className="eyebrow">
            {t(kind === 'lore' ? 'contribute.writeLore' : 'contribute.uploadSound')}
          </p>
          <h2>{t(headingKey)}</h2>
          {/* <p className="dreamy-section-hint">{t(hintKey)}</p> */}
        </div>
        <CommunityUpload
          kind={kind}
          onPublished={() => {
            setRefreshKey((value) => value + 1);
            if (kind === 'sound') refreshSoundCatalog();
          }}
        />
      </header>
      {notice && (
        <p className="my-contributions-notice" role="status">
          {notice}
        </p>
      )}
      {error && !items.length && (
        <div className="my-contributions-error" role="alert">
          <p>{t(loadErrorKey)}</p>
          <button
            className="button secondary compact"
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            {t('common.retry')}
          </button>
        </div>
      )}
      {error && items.length > 0 && (
        <div className="my-contributions-error" role="alert">
          <p>{t(loadErrorKey)}</p>
          <button
            className="button secondary compact"
            type="button"
            onClick={() => loadNext.current()}
          >
            {t('common.retry')}
          </button>
        </div>
      )}
      <div className="my-contributions-grid" aria-busy={loading}>
        {kind === 'lore' &&
          items.map(
            (item) =>
              'text' in item && (
                <article className="my-contribution-card" key={item.id}>
                  <span
                    className={`my-contribution-status ${item.status === 'Draft' ? 'draft' : 'published'}`}
                  >
                    {t(item.status === 'Draft' ? 'character.draft' : 'character.published')}
                  </span>
                  {item.imageUrls[0] && (
                    <img
                      className="my-contribution-cover"
                      src={item.imageUrls[0]}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <div className="my-contribution-copy">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <div className="my-contribution-meta">
                      <span>
                        {t('contribute.tags')}: {item.tags.length.toLocaleString(locale)}
                      </span>
                      <span>
                        {item.translations.length.toLocaleString(locale)}{' '}
                        {t('contribute.translatedEditions')}
                      </span>
                    </div>
                    <div className="my-contribution-actions">
                      <button
                        className="button secondary compact"
                        type="button"
                        onClick={() => {
                          setDeleteOnOpen(false);
                          setSelected(item);
                        }}
                      >
                        <Pencil size={15} aria-hidden="true" />
                        {t('profile.itemEdit')}
                      </button>
                      <button
                        className="my-contribution-delete"
                        type="button"
                        onClick={() => {
                          setDeleteOnOpen(true);
                          setSelected(item);
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        {t('profile.itemDelete')}
                      </button>
                    </div>
                  </div>
                </article>
              ),
          )}
        {kind === 'sound' &&
          items.map(
            (item) =>
              'file' in item && (
                <article className="my-contribution-card my-contribution-sound" key={item.id}>
                  <span
                    className={`my-contribution-status ${item.status === 'Draft' ? 'draft' : 'published'}`}
                  >
                    {t(item.status === 'Draft' ? 'character.draft' : 'character.published')}
                  </span>
                  <SoundPlayback sound={{ ...item, color: 0, playCount: 0 }} preview heading />
                  <div className="my-contribution-copy">
                    <div className="my-contribution-actions">
                      <button
                        className="button secondary compact"
                        type="button"
                        onClick={() => {
                          setDeleteOnOpen(false);
                          setSelected(item);
                        }}
                      >
                        <Pencil size={15} aria-hidden="true" />
                        {t('profile.itemEdit')}
                      </button>
                      <button
                        className="my-contribution-delete"
                        type="button"
                        onClick={() => {
                          setDeleteOnOpen(true);
                          setSelected(item);
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        {t('profile.itemDelete')}
                      </button>
                    </div>
                  </div>
                </article>
              ),
          )}
      </div>
      {ended && !items.length && !loading && !error && (
        <div className="my-contributions-empty">
          {kind === 'lore' ? (
            <BookOpen size={30} aria-hidden="true" />
          ) : (
            <Music2 size={30} aria-hidden="true" />
          )}
          <p>{t(emptyKey)}</p>
        </div>
      )}
      {loading && <LoadingIndicator label={t('common.loading')} />}
      <div ref={setSentinel} className="my-contributions-sentinel" />
      {selected && (
        <ContributionEditDialog
          key={`${selected.kind}-${selected.id}`}
          item={selected}
          initialDelete={deleteOnOpen}
          onClose={() => {
            setSelected(null);
            setDeleteOnOpen(false);
          }}
          onSaved={updateItem}
          onDeleted={removeItem}
        />
      )}
    </div>
  );
}

function ContributionEditDialog({
  item,
  initialDelete,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: ManagedItem;
  initialDelete: boolean;
  onClose: () => void;
  onSaved: (item: ManagedItem) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useI18n();
  const { getIdToken } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitting = useRef(false);
  const previews = useRef<string[]>([]);
  const headingId = `manage-contribution-${item.id}`;
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(initialDelete);
  const [error, setError] = useState('');
  const [title, setTitle] = useState(item.kind === 'lore' ? item.title : item.name);
  const [category, setCategory] = useState(item.kind === 'sound' ? item.category : '');
  const [text, setText] = useState(item.kind === 'lore' ? item.text : '');
  const [tag, setTag] = useState('');
  const [tags, setTags] = useState(item.kind === 'lore' ? item.tags : []);
  const [translations, setTranslations] = useState<LoreTranslation[]>(
    item.kind === 'lore' ? item.translations : [],
  );
  const [images, setImages] = useState<LoreImage[]>(
    item.kind === 'lore'
      ? item.imageKeys.map((key, index) => ({ key, url: item.imageUrls[index] ?? '' }))
      : [],
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<{ file: File; soundKey: string } | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
      previews.current.forEach((url) => URL.revokeObjectURL(url));
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function finish(action: () => void) {
    if (closeTimer.current !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      action();
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(action, 160);
  }

  function dismiss() {
    if (!submitting.current && !closing) finish(onClose);
  }

  async function request(path: string, method = 'GET', body?: Record<string, unknown>) {
    const token = await getIdToken();
    if (!token) throw new Error('401');
    const response = await fetch(apiUrl(path), {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(String(response.status));
    return response.status === 204 ? null : response.json();
  }

  async function addImages(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (!selected.length || item.kind !== 'lore') return;
    if (images.length + selected.length > 5) {
      setError(t('contribute.imageLimit'));
      return;
    }
    submitting.current = true;
    setUploadingImages(true);
    setError('');
    const added: LoreImage[] = [];
    try {
      for (const image of selected) {
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(image.type) ||
          image.size < 1 ||
          image.size > 3 * 1024 * 1024
        )
          throw new Error('image');
        const upload = (await request('lores/images/presign', 'POST', {
          submissionId: item.id,
          contentType: image.type,
          size: image.size,
        })) as { key: string; uploadUrl: string; uploadHeaders: Record<string, string> };
        const response = await fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: upload.uploadHeaders,
          body: image,
        });
        if (!response.ok) throw new Error('upload');
        const url = URL.createObjectURL(image);
        previews.current.push(url);
        added.push({ key: upload.key, url, local: true });
      }
      setImages((current) => [...current, ...added]);
    } catch (reason) {
      setImages((current) => [...current, ...added]);
      setError(
        reason instanceof Error && reason.message === 'image'
          ? t('contribute.imageInvalid')
          : errorText(reason, t),
      );
    } finally {
      submitting.current = false;
      setUploadingImages(false);
    }
  }

  function addTag() {
    const value = tag.trim();
    if (
      value &&
      tags.length < 10 &&
      !tags.some((current) => current.toLowerCase() === value.toLowerCase())
    )
      setTags((current) => [...current, value]);
    setTag('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = submitter?.value === 'Draft' ? 'Draft' : 'Published';
    if (submitting.current || closing) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (item.kind === 'sound') {
        let soundKey = uploadedAudio?.file === audioFile ? uploadedAudio.soundKey : undefined;
        if (audioFile && !soundKey) {
          const type = audioFile.type.toLowerCase().split(';')[0].trim();
          if (!soundTypes.has(type) || audioFile.size < 1 || audioFile.size > 20 * 1024 * 1024)
            throw new Error('audio');
          const upload = (await request('sounds/presign', 'POST', {
            fileName: audioFile.name,
            contentType: type,
            size: audioFile.size,
          })) as { soundKey: string; uploadUrl: string; uploadHeaders: Record<string, string> };
          const response = await fetch(upload.uploadUrl, {
            method: 'PUT',
            headers: upload.uploadHeaders,
            body: audioFile,
          });
          if (!response.ok) throw new Error('upload');
          soundKey = upload.soundKey;
          setUploadedAudio({ file: audioFile, soundKey });
        }
        const response = await request(`sounds/${encodeURIComponent(item.id)}`, 'PATCH', {
          status,
          name: title.trim(),
          category: category.trim(),
          ...(soundKey ? { soundKey } : {}),
        });
        finish(() =>
          onSaved({
            ...item,
            ...response.sound,
            status,
            name: title.trim(),
            category: category.trim(),
          }),
        );
      } else {
        const selectedTags =
          tag.trim() && !tags.some((current) => current.toLowerCase() === tag.trim().toLowerCase())
            ? [...tags, tag.trim()]
            : tags;
        if (selectedTags.length > 10 || selectedTags.some((value) => value.length > 40))
          throw new Error('tags');
        const response = (await request(`lores/${encodeURIComponent(item.id)}`, 'PATCH', {
          status,
          title: title.trim(),
          text: text.trim(),
          tags: selectedTags,
          translations,
          imageKeys: images.map((image) => image.key),
        })) as { lore: Omit<ManagedLore, 'kind' | 'createdAt'> };
        finish(() => onSaved({ ...item, ...response.lore, status, kind: 'lore' }));
      }
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === 'audio'
          ? t('contribute.audioInvalid')
          : reason instanceof Error && reason.message === 'tags'
            ? t('contribute.tagsInvalid')
            : errorText(reason, t),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function deleteItem() {
    if (submitting.current || closing) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await request(
        `${item.kind === 'lore' ? 'lores' : 'sounds'}/${encodeURIComponent(item.id)}`,
        'DELETE',
      );
      finish(() => onDeleted(item.id));
    } catch (reason) {
      setError(errorText(reason, t, 'profile.contributionDeleteError'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="video-manage-backdrop"
      data-closing={closing || undefined}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <section
        className="video-manage-dialog community-upload-dialog my-contribution-dialog"
        inert={closing}
      >
        <button
          type="button"
          className="video-manage-close"
          aria-label={t('chat.dismiss')}
          disabled={busy || uploadingImages}
          onClick={dismiss}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id={headingId}>
          {t(confirmingDelete ? 'profile.deleteItemTitle' : 'profile.editItemTitle')}
        </h2>
        {confirmingDelete ? (
          <>
            <p>
              {t(item.kind === 'lore' ? 'profile.deleteLorePrompt' : 'profile.deleteSoundPrompt')}
            </p>
            {error && (
              <p className="video-manage-error" role="alert">
                {error}
              </p>
            )}
            <div className="video-manage-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setConfirmingDelete(false);
                  setError('');
                }}
              >
                {t('chat.dismiss')}
              </button>
              <button
                type="button"
                className="button video-manage-confirm-delete"
                disabled={busy}
                onClick={() => void deleteItem()}
              >
                <Trash2 size={15} aria-hidden="true" />
                {t(busy ? 'profile.deletingItem' : 'profile.confirmDeleteItem')}
              </button>
            </div>
          </>
        ) : (
          <form className="video-manage-form" onSubmit={save}>
            <p className="community-upload-notice">{t('contribute.draftNotice')}</p>
            <label>
              {t(item.kind === 'lore' ? 'contribute.loreTitle' : 'contribute.soundName')}
              <input
                required
                maxLength={item.kind === 'lore' ? 120 : 80}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            {item.kind === 'sound' ? (
              <>
                <label>
                  {t('contribute.category')}
                  <input
                    required
                    maxLength={48}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  />
                </label>
                <label className="my-contribution-audio-picker">
                  <span>{t('profile.replaceAudio')}</span>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/webm,audio/aac"
                    disabled={busy}
                    onChange={(event) => {
                      setAudioFile(event.target.files?.[0] ?? null);
                      setUploadedAudio(null);
                      setError('');
                      event.target.value = '';
                    }}
                  />
                </label>
                <p className="community-upload-field-hint">{t('profile.keepCurrentAudio')}</p>
                {audioFile && <p className="community-upload-field-hint">{audioFile.name}</p>}
              </>
            ) : (
              <>
                <label>
                  {t('contribute.loreText')}
                  <textarea
                    required
                    maxLength={200000}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                  <small className="community-upload-character-count">
                    {t('contribute.characterCount', {
                      count: text.length.toLocaleString(),
                      limit: '200,000',
                    })}
                  </small>
                </label>
                <div className="community-upload-tag-field">
                  <label htmlFor={`${headingId}-tag`}>{t('contribute.tags')}</label>
                  {Boolean(tags.length) && (
                    <div className="community-upload-tags">
                      {tags.map((value, index) => (
                        <span key={`${value}-${index}`}>
                          {value}
                          <button
                            type="button"
                            aria-label={t('contribute.removeTag', { tag: value })}
                            onClick={() =>
                              setTags((current) => current.filter((_, i) => i !== index))
                            }
                          >
                            <X size={13} aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    id={`${headingId}-tag`}
                    value={tag}
                    maxLength={40}
                    disabled={busy || tags.length >= 10}
                    placeholder={t('contribute.tagPlaceholder')}
                    onChange={(event) => setTag(event.target.value)}
                    onBlur={addTag}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <p className="community-upload-field-hint">{t('contribute.tagsHint')}</p>
                </div>
                <section
                  className="community-upload-translations"
                  aria-label={t('contribute.translatedEditions')}
                >
                  <header>
                    <h3>{t('contribute.translatedEditions')}</h3>
                    <button
                      className="button secondary compact"
                      type="button"
                      disabled={translations.length >= 10 || busy}
                      onClick={() =>
                        setTranslations((current) => [
                          ...current,
                          { locale: '', label: '', title: '', text: '' },
                        ])
                      }
                    >
                      {t('contribute.addLanguage')}
                    </button>
                  </header>
                  {translations.map((translation, index) => (
                    <article key={index}>
                      <div className="community-upload-translation-title">
                        <strong>{t('contribute.languageEdition', { number: index + 1 })}</strong>
                        <button
                          type="button"
                          className="community-upload-remove"
                          aria-label={t('contribute.removeTranslation', { number: index + 1 })}
                          onClick={() =>
                            setTranslations((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="community-upload-translation-grid">
                        <label>
                          {t('contribute.languageName')}
                          <input
                            required
                            maxLength={48}
                            value={translation.label}
                            onChange={(event) =>
                              setTranslations((current) =>
                                current.map((entry, i) =>
                                  i === index ? { ...entry, label: event.target.value } : entry,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          {t('contribute.languageCode')}
                          <input
                            required
                            maxLength={16}
                            value={translation.locale}
                            onChange={(event) =>
                              setTranslations((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? { ...entry, locale: event.target.value.toLowerCase() }
                                    : entry,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                      <label>
                        {t('contribute.translatedTitle')}
                        <input
                          required
                          maxLength={120}
                          value={translation.title}
                          onChange={(event) =>
                            setTranslations((current) =>
                              current.map((entry, i) =>
                                i === index ? { ...entry, title: event.target.value } : entry,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        {t('contribute.translatedText')}
                        <textarea
                          required
                          maxLength={200000}
                          value={translation.text}
                          onChange={(event) =>
                            setTranslations((current) =>
                              current.map((entry, i) =>
                                i === index ? { ...entry, text: event.target.value } : entry,
                              ),
                            )
                          }
                        />
                        <small className="community-upload-character-count">
                          {t('contribute.characterCount', {
                            count: translation.text.length.toLocaleString(),
                            limit: '200,000',
                          })}
                        </small>
                      </label>
                    </article>
                  ))}
                </section>
                <section className="community-upload-images">
                  <div className="community-upload-translations-header">
                    <div>
                      <h3>{t('contribute.loreImages')}</h3>
                      <p>{t('contribute.imagesHint')}</p>
                    </div>
                    <label className="button secondary compact">
                      <Upload size={15} aria-hidden="true" />
                      {t('contribute.addImage')}
                      <input
                        ref={imageInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={busy || uploadingImages}
                        onChange={(event) => {
                          void addImages(event.target.files);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {images.length > 0 && (
                    <div className="community-upload-image-grid">
                      {images.map((image, index) => (
                        <div key={image.key}>
                          {image.url && <img src={image.url} alt="" />}
                          <button
                            type="button"
                            className="community-upload-remove"
                            aria-label={t('contribute.removeImage', { number: index + 1 })}
                            disabled={busy || uploadingImages}
                            onClick={() => {
                              if (image.local) {
                                URL.revokeObjectURL(image.url);
                                previews.current = previews.current.filter(
                                  (url) => url !== image.url,
                                );
                              }
                              setImages((current) => current.filter((_, i) => i !== index));
                            }}
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploadingImages && (
                    <p className="community-upload-field-hint" role="status">
                      {t('contribute.uploadingImages')}
                    </p>
                  )}
                </section>
              </>
            )}
            {error && (
              <p className="video-manage-error" role="alert">
                {error}
              </p>
            )}
            <div className="video-manage-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy || uploadingImages}
                onClick={dismiss}
              >
                {t('chat.dismiss')}
              </button>
              <button
                type="submit"
                value="Draft"
                className="button secondary"
                disabled={
                  busy || uploadingImages || !title.trim() || (item.kind === 'lore' && !text.trim())
                }
              >
                {t('contribute.saveDraft')}
              </button>
              <button
                type="submit"
                value="Published"
                className="button dark"
                disabled={
                  busy || uploadingImages || !title.trim() || (item.kind === 'lore' && !text.trim())
                }
              >
                <Pencil size={15} aria-hidden="true" />
                {t(
                  busy
                    ? 'profile.savingItem'
                    : item.status === 'Draft'
                      ? item.kind === 'lore'
                        ? 'contribute.publishLore'
                        : 'contribute.publishSound'
                      : 'profile.saveItem',
                )}
              </button>
            </div>
            <button
              type="button"
              className="video-manage-delete"
              disabled={busy || uploadingImages}
              onClick={() => {
                setConfirmingDelete(true);
                setError('');
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              {t('profile.itemDelete')}
            </button>
          </form>
        )}
      </section>
    </dialog>
  );
}
