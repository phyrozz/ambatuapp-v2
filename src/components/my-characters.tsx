'use client';

import Link from 'next/link';
import { Plus, Pencil, Users, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
import './community-upload.css';
import './my-contributions.css';
import './my-characters.css';

type OwnCharacter = {
  id: string;
  name: string;
  title: string;
  bio: string;
  tags: string[];
  status: 'Draft' | 'Published';
  imageKey: string | null;
  imageUrl: string | null;
};
function api(path = '') {
  // Keep local web requests on the revamp origin; Next forwards them to admin.
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.NATIVE_BUILD !== '1' &&
    process.env.NEXT_PUBLIC_CHARACTER_API_URL
  )
    return `/api/public/contributions/characters${path}`;
  const base =
    process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ??
    `${window.location.origin}/api/public`;
  return `${base}/contributions/characters${path}`;
}

export function MyCharacters({ active }: { active: boolean }) {
  const { t } = useI18n();
  const { user, getIdToken } = useAuth();
  const [items, setItems] = useState<OwnCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<OwnCharacter | 'new' | null>(null);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const next = useRef<() => void>(() => {});

  useEffect(() => {
    if (!active || !user) return;
    const controller = new AbortController();
    let cursor: string | null = null,
      pending = false,
      done = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    setEnded(false);
    async function load() {
      if (pending || done || controller.signal.aborted) return;
      pending = true;
      setLoading(true);
      setError(false);
      try {
        const token = await getIdToken();
        if (!token) throw new Error('401');
        const query = new URLSearchParams({ limit: '20' });
        if (cursor) query.set('cursor', cursor);
        const response = await fetch(api(`?${query}`), {
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('load');
        const data = (await response.json()) as {
          characters: OwnCharacter[];
          nextCursor: string | null;
        };
        if (controller.signal.aborted) return;
        setItems((previous) => [
          ...new Map([...previous, ...data.characters].map((item) => [item.id, item])).values(),
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
    }
    next.current = () => void load();
    void load();
    return () => controller.abort();
  }, [active, user, getIdToken, refresh]);

  useEffect(() => {
    if (!active || !sentinel || loading || error || ended) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) next.current();
      },
      { rootMargin: '320px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [active, sentinel, loading, error, ended, items]);

  return (
    <div className="my-characters">
      <header className="my-contributions-heading">
        <div>
          <p className="eyebrow">{t('character.add')}</p>
          <h2>{t('profile.tabCharacters')}</h2>
          <p className="dreamy-section-hint">{t('profile.charactersHint')}</p>
        </div>
        <div className="community-upload-entry">
          <button className="button dark compact" onClick={() => setEditing('new')}>
            <Plus size={17} aria-hidden="true" />
            {t('character.add')}
          </button>
        </div>
      </header>
      {!loading && !error && !items.length && (
        <div className="my-characters-empty">
          <Users size={34} aria-hidden="true" />
          <h3>{t('profile.charactersEmpty')}</h3>
          <p>{t('profile.charactersHint')}</p>
        </div>
      )}
      <div className="my-characters-grid">
        {items.map((item) => (
          <article key={item.id}>
            <div className="my-character-portrait">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" />
              ) : (
                <Users size={44} aria-hidden="true" />
              )}
              <span className={`my-character-status ${item.status.toLowerCase()}`}>
                {t(item.status === 'Draft' ? 'character.draft' : 'character.published')}
              </span>
            </div>
            <div className="my-character-copy">
              <h3>{item.name}</h3>
              <p>{item.title}</p>
              {!!item.tags.length && (
                <div className="community-upload-tags my-character-tags">
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
              <div className="my-character-actions">
                <button
                  className="button secondary compact"
                  onClick={() => setEditing(item)}
                  aria-label={t('character.editNamed', { name: item.name })}
                >
                  <Pencil size={14} aria-hidden="true" />
                  {t('profile.itemEdit')}
                </button>
                {item.status === 'Published' && (
                  <Link
                    className="button secondary compact"
                    href={`/characters/${encodeURIComponent(item.id)}/`}
                  >
                    {t('character.view')}
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      <div ref={setSentinel} className="my-characters-sentinel">
        {loading && <LoadingIndicator label={t('common.loading')} compact />}
        {error && (
          <div role="alert">
            <p>{t('characters.loadError')}</p>
            <button className="button secondary" onClick={() => next.current()}>
              {t('common.retry')}
            </button>
          </div>
        )}
      </div>
      {editing && (
        <CharacterEditor
          key={editing === 'new' ? 'new' : editing.id}
          character={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRefresh((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}

function CharacterEditor({
  character,
  onClose,
  onSaved,
}: {
  character?: OwnCharacter;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { getIdToken } = useAuth();
  const [submissionId] = useState(() => character?.id ?? crypto.randomUUID());
  const [name, setName] = useState(character?.name ?? '');
  const [title, setTitle] = useState(character?.title ?? '');
  const [bio, setBio] = useState(character?.bio ?? '');
  const [tags, setTags] = useState<string[]>(character?.tags ?? []);
  const [tag, setTag] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState(character?.imageUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const uploaded = useRef<{ file: File; key: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setPreview(url); // eslint-disable-line react-hooks/set-state-in-effect
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function selectedTags() {
    const result = [...tags];
    for (const value of tag
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (!result.some((existing) => existing.toLowerCase() === value.toLowerCase()))
        result.push(value);
    }
    return result;
  }

  function addTag() {
    const result = selectedTags();
    if (result.length > 10 || result.some((value) => value.length > 40)) {
      setError(t('contribute.tagsInvalid'));
      return;
    }
    setTags(result);
    setTag('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = submitter?.value === 'Draft' ? 'Draft' : 'Published';
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const finalTags = selectedTags();
      if (finalTags.length > 10 || finalTags.some((tag) => tag.length > 40))
        throw new Error('tags');
      const token = await getIdToken();
      if (!token) throw new Error('401');
      async function request(path: string, body: unknown, method = 'POST') {
        const response = await fetch(api(path), {
          method,
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      }
      let imageKey = character?.imageKey ?? null;
      if (image) {
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(image.type) ||
          image.size < 1 ||
          image.size > 3 * 1024 * 1024
        )
          throw new Error('image');
        if (uploaded.current?.file !== image) {
          const upload = await request('/images/presign', {
            submissionId,
            contentType: image.type,
            size: image.size,
          });
          const response = await fetch(upload.uploadUrl, {
            method: 'PUT',
            headers: upload.uploadHeaders,
            body: image,
          });
          if (!response.ok) throw new Error('upload');
          uploaded.current = { file: image, key: upload.key };
        }
        imageKey = uploaded.current!.key;
      }
      await request(
        character ? `/${encodeURIComponent(character.id)}` : '',
        { submissionId, name, title, bio, tags: finalTags, status, imageKey },
        character ? 'PATCH' : 'POST',
      );
      onSaved();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : '';
      setError(
        t(
          code === 'tags'
            ? 'contribute.tagsInvalid'
            : code === 'image'
              ? 'contribute.imageInvalid'
              : code === '401'
                ? 'contribute.sessionExpired'
                : code === '429'
                  ? 'contribute.rateLimited'
                  : 'profile.contributionSaveError',
        ),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="video-manage-backdrop"
      aria-labelledby="character-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending.current) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending.current) onClose();
      }}
    >
      <section className="video-manage-dialog community-upload-dialog character-editor">
        <button
          type="button"
          className="video-manage-close"
          aria-label={t('chat.dismiss')}
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id="character-editor-title">{t(character ? 'character.edit' : 'character.add')}</h2>
        <p>{t('profile.charactersHint')}</p>
        <form className="video-manage-form" onSubmit={save}>
          <fieldset className="community-upload-fields" disabled={busy}>
            <section className="community-upload-images character-portrait-picker">
              <div className="community-upload-translations-header">
                <div>
                  <h3>{t('character.portrait')}</h3>
                  <p>{t('contribute.imageInvalid')}</p>
                </div>
                <label className="button secondary compact">
                  <Upload size={15} aria-hidden="true" />
                  {t('character.choosePortrait')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      setImage(event.target.files?.[0] ?? null);
                      uploaded.current = null;
                    }}
                  />
                </label>
              </div>
              {preview && (
                <div className="community-upload-image-grid">
                  <div>
                    <img src={preview} alt="" />
                  </div>
                </div>
              )}
            </section>
            <div className="character-form-row">
              <label>
                {t('character.name')}
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                {t('character.role')}
                <input
                  required
                  maxLength={120}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
            </div>
            <label>
              {t('character.bio')}
              <textarea
                maxLength={20000}
                rows={6}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </label>
            <div className="community-upload-tag-field">
              <label htmlFor="character-tag">{t('contribute.tags')}</label>
              {!!tags.length && (
                <div className="community-upload-tags">
                  {tags.map((value) => (
                    <span key={value}>
                      {value}
                      <button
                        type="button"
                        aria-label={t('contribute.removeTag', { tag: value })}
                        onClick={() =>
                          setTags((current) => current.filter((item) => item !== value))
                        }
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                id="character-tag"
                value={tag}
                maxLength={40}
                placeholder={t('contribute.tagPlaceholder')}
                aria-describedby="character-tags-hint"
                onChange={(event) => setTag(event.target.value)}
                onBlur={addTag}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    addTag();
                  }
                }}
              />
              <p className="community-upload-field-hint" id="character-tags-hint">
                {t('contribute.tagsHint')}
              </p>
            </div>
          </fieldset>
          <p className="community-upload-notice">{t('character.statusHint')}</p>
          {error && (
            <p className="video-manage-error" role="alert">
              {error}
            </p>
          )}
          <div className="video-manage-actions">
            <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
              {t('chat.dismiss')}
            </button>
            <button type="submit" value="Draft" className="button secondary" disabled={busy}>
              {t('character.saveDraft')}
            </button>
            <button type="submit" value="Published" className="button dark" disabled={busy}>
              {t(
                busy
                  ? 'profile.savingItem'
                  : character?.status === 'Published'
                    ? 'profile.saveItem'
                    : 'character.publish',
              )}
            </button>
          </div>
        </form>
      </section>
    </dialog>
  );
}
