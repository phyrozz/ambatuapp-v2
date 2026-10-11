'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { BookOpen, Upload, X } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import './community-upload.css';

type ContentKind = 'sound' | 'lore';
type LoreTranslation = { locale: string; label: string; title: string; text: string };
const audioTypes: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  webm: 'audio/webm',
};

export function CommunityUpload({
  kind,
  onPublished,
}: {
  kind: ContentKind;
  onPublished: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [published, setPublished] = useState(false);
  return (
    <div className="community-upload-entry">
      <button
        className="button dark compact"
        type="button"
        onClick={() => {
          setPublished(false);
          setOpen(true);
        }}
      >
        {kind === 'sound' ? (
          <Upload size={17} aria-hidden="true" />
        ) : (
          <BookOpen size={17} aria-hidden="true" />
        )}
        {t(kind === 'sound' ? 'contribute.uploadSound' : 'contribute.writeLore')}
      </button>
      {published && (
        <p className="community-upload-success" role="status">
          {t(kind === 'sound' ? 'contribute.soundSuccess' : 'contribute.loreSuccess')}
        </p>
      )}
      {open && (
        <CommunityUploadDialog
          kind={kind}
          onClose={() => setOpen(false)}
          onPublished={() => {
            setOpen(false);
            setPublished(true);
            onPublished();
          }}
        />
      )}
    </div>
  );
}

function CommunityUploadDialog({
  kind,
  onClose,
  onPublished,
}: {
  kind: ContentKind;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { t } = useI18n();
  const { user, ready, configured, getIdToken, signInWithGoogle } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const closingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitting = useRef(false);
  const submissionId = useRef<string | null>(null);
  const previews = useRef<string[]>([]);
  const headingId = useId();
  const hintId = useId();
  const tagsHintId = useId();
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Classics');
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [translations, setTranslations] = useState<LoreTranslation[]>([]);
  const [images, setImages] = useState<{ key: string; url: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<{ file: File; soundKey: string } | null>(null);

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (closingTimer.current !== null) clearTimeout(closingTimer.current);
      previews.current.forEach(URL.revokeObjectURL);
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function finish(action: () => void) {
    if (closingTimer.current !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      action();
      return;
    }
    setClosing(true);
    closingTimer.current = setTimeout(action, 160);
  }

  function dismiss() {
    if (!submitting.current && !closing) finish(onClose);
  }

  async function post(path: string, body: Record<string, unknown>) {
    const token = await getIdToken();
    if (!token) throw new Error('contribute.sessionExpired');
    const base =
      process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ??
      `${window.location.origin}/api/public`;
    const response = await fetch(`${base}/contributions/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'contribute.sessionExpired'
          : response.status === 429
            ? 'contribute.rateLimited'
            : 'contribute.failed',
      );
    return response.json();
  }

  function addTag() {
    const value = tag.trim();
    if (value && !tags.some((item) => item.toLowerCase() === value.toLowerCase()))
      setTags((current) => [...current, value]);
    setTag('');
  }

  async function uploadImages(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    if (images.length + selected.length > 5) {
      setError(t('contribute.imageLimit'));
      return;
    }
    submissionId.current ??= crypto.randomUUID();
    submitting.current = true;
    setUploading(true);
    setError('');
    const added: { key: string; url: string }[] = [];
    try {
      for (const image of selected) {
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(image.type) ||
          image.size < 1 ||
          image.size > 3 * 1024 * 1024
        )
          throw new Error('contribute.imageInvalid');
        const upload = (await post('lores/images/presign', {
          submissionId: submissionId.current,
          contentType: image.type,
          size: image.size,
        })) as { key: string; uploadUrl: string; uploadHeaders: Record<string, string> };
        const response = await fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: upload.uploadHeaders,
          body: image,
        });
        if (!response.ok) throw new Error('contribute.failed');
        const url = URL.createObjectURL(image);
        previews.current.push(url);
        added.push({ key: upload.key, url });
      }
      setImages((current) => [...current, ...added]);
    } catch (reason) {
      added.forEach((image) => {
        URL.revokeObjectURL(image.url);
        previews.current = previews.current.filter((url) => url !== image.url);
      });
      const key =
        reason instanceof Error &&
        ['contribute.sessionExpired', 'contribute.rateLimited', 'contribute.imageInvalid'].includes(
          reason.message,
        )
          ? reason.message
          : 'contribute.failed';
      setError(t(key));
    } finally {
      submitting.current = false;
      setUploading(false);
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || closing || !user) return;
    setError('');
    const pendingTag = tag.trim();
    const selectedTags =
      pendingTag && !tags.some((item) => item.toLowerCase() === pendingTag.toLowerCase())
        ? [...tags, pendingTag]
        : tags;
    if (
      kind === 'lore' &&
      (selectedTags.length > 10 || selectedTags.some((tag) => tag.length > 40))
    ) {
      setError(t('contribute.tagsInvalid'));
      return;
    }
    const contentType = file
      ? audioTypes[file.name.split('.').at(-1)?.toLowerCase() ?? '']
      : undefined;
    if (
      kind === 'sound' &&
      (!file || !contentType || file.size < 1 || file.size > 20 * 1024 * 1024)
    ) {
      setError(t('contribute.audioInvalid'));
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('contribute.sessionExpired');
      if (kind === 'sound' && file && contentType) {
        let soundKey = uploadedAudio?.file === file ? uploadedAudio.soundKey : null;
        if (!soundKey) {
          const upload = await post('sounds/presign', {
            fileName: file.name,
            contentType,
            size: file.size,
          });
          const response = await fetch(upload.uploadUrl, {
            method: 'PUT',
            headers: upload.uploadHeaders,
            body: file,
          });
          if (!response.ok) throw new Error('contribute.failed');
          soundKey = upload.soundKey as string;
          setUploadedAudio({ file, soundKey });
        }
        await post('sounds', { name: title.trim(), category: category.trim(), soundKey });
      } else {
        submissionId.current ??= crypto.randomUUID();
        await post('lores', {
          submissionId: submissionId.current,
          title: title.trim(),
          text: text.trim(),
          tags: selectedTags,
          translations,
          imageKeys: images.map((image) => image.key),
        });
      }
      finish(onPublished);
    } catch (reason) {
      const key =
        reason instanceof Error &&
        [
          'contribute.sessionExpired',
          'contribute.rateLimited',
          'contribute.audioInvalid',
          'contribute.tagsInvalid',
          'contribute.imageInvalid',
        ].includes(reason.message)
          ? reason.message
          : 'contribute.failed';
      setError(t(key));
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
      aria-describedby={hintId}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <section className="video-manage-dialog community-upload-dialog" inert={closing}>
        <button
          className="video-manage-close"
          type="button"
          aria-label={t('chat.dismiss')}
          disabled={busy || uploading}
          onClick={dismiss}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id={headingId}>
          {t(kind === 'sound' ? 'contribute.uploadSound' : 'contribute.writeLore')}
        </h2>
        <p id={hintId}>{t(kind === 'sound' ? 'contribute.soundHint' : 'contribute.loreHint')}</p>
        {!user ? (
          <div className="community-upload-login">
            <p>{t('contribute.signIn')}</p>
            <button
              type="button"
              className="button dark"
              disabled={!ready || !configured}
              onClick={() => {
                void signInWithGoogle(window.location.pathname).catch(() =>
                  setError(t('contribute.failed')),
                );
              }}
            >
              {t('profile.googleSignIn')}
            </button>
            {error && (
              <p className="video-manage-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <form className="video-manage-form" onSubmit={publish}>
            <fieldset className="community-upload-fields" disabled={busy}>
              <label>
                {t(kind === 'sound' ? 'contribute.soundName' : 'contribute.loreTitle')}
                <input
                  required
                  maxLength={kind === 'sound' ? 80 : 120}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              {kind === 'sound' ? (
                <>
                  <label>
                    {t('contribute.category')}
                    <input
                      required
                      maxLength={48}
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      placeholder={t('contribute.categoryPlaceholder')}
                    />
                  </label>
                  <label>
                    {t('contribute.audioFile')}
                    <input
                      type="file"
                      required
                      accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/webm,audio/aac"
                      onChange={(event) => {
                        setFile(event.target.files?.[0] ?? null);
                        setUploadedAudio(null);
                        setError('');
                      }}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    {t('contribute.loreText')}
                    <textarea
                      className="community-lore-text"
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
                        {tags.map((item, index) => (
                          <span key={`${item}-${index}`}>
                            {item}
                            <button
                              type="button"
                              aria-label={t('contribute.removeTag', { tag: item })}
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
                      disabled={busy || uploading}
                      aria-describedby={tagsHintId}
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
                    <p className="community-upload-field-hint" id={tagsHintId}>
                      {t('contribute.tagsHint')}
                    </p>
                  </div>
                </>
              )}
            </fieldset>
            {kind === 'lore' && (
              <>
                <section
                  className="community-upload-translations"
                  aria-label={t('contribute.translatedEditions')}
                >
                  <header>
                    <h3>{t('contribute.translatedEditions')}</h3>
                    <button
                      className="button secondary compact"
                      type="button"
                      disabled={translations.length >= 10}
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
                                current.map((item, i) =>
                                  i === index ? { ...item, label: event.target.value } : item,
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
                                current.map((item, i) =>
                                  i === index
                                    ? { ...item, locale: event.target.value.toLowerCase() }
                                    : item,
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
                              current.map((item, i) =>
                                i === index ? { ...item, title: event.target.value } : item,
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
                              current.map((item, i) =>
                                i === index ? { ...item, text: event.target.value } : item,
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
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={busy || uploading}
                        onChange={(event) => {
                          void uploadImages(event.target.files);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {images.length > 0 && (
                    <div className="community-upload-image-grid">
                      {images.map((image, index) => (
                        <div key={image.key}>
                          <img src={image.url} alt="" />
                          <button
                            type="button"
                            className="community-upload-remove"
                            aria-label={t('contribute.removeImage', { number: index + 1 })}
                            disabled={busy || uploading}
                            onClick={() => {
                              URL.revokeObjectURL(image.url);
                              previews.current = previews.current.filter(
                                (url) => url !== image.url,
                              );
                              setImages((current) => current.filter((_, i) => i !== index));
                            }}
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploading && (
                    <p className="community-upload-field-hint" role="status">
                      {t('contribute.uploadingImages')}
                    </p>
                  )}
                </section>
              </>
            )}
            <p className="community-upload-notice">{t('contribute.publicNotice')}</p>
            {error && (
              <p className="video-manage-error" role="alert">
                {error}
              </p>
            )}
            <div className="video-manage-actions">
              <button className="button secondary" type="button" disabled={busy} onClick={dismiss}>
                {t('chat.dismiss')}
              </button>
              <button
                className="button dark"
                type="submit"
                disabled={
                  busy ||
                  !title.trim() ||
                  (kind === 'sound' ? !category.trim() || !file : !text.trim())
                }
              >
                <Upload size={16} aria-hidden="true" />
                {t(
                  busy
                    ? 'contribute.publishing'
                    : kind === 'sound'
                      ? 'contribute.publishSound'
                      : 'contribute.publishLore',
                )}
              </button>
            </div>
          </form>
        )}
      </section>
    </dialog>
  );
}
