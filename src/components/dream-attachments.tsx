'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ImagePlus, Maximize, Play, X } from 'lucide-react';
import {
  dreamApi,
  DreamApiError,
  dreamErrorKey,
  dreamRequestKey,
  type DreamAttachment,
} from '@/lib/ambatupost';
import { useI18n } from './i18n-provider';
import { MediaPlayer } from './media-player';

export type DraftAttachment = DreamAttachment & {
  localId?: string;
  file?: File;
  uploaded?: boolean;
  progress?: number;
  uploadError?: string;
};
type Token = () => Promise<string | null>;

export function DreamAttachments({
  items,
  setItems,
  getToken,
  disabled,
  committed,
}: {
  items: DraftAttachment[];
  setItems: Dispatch<SetStateAction<DraftAttachment[]>>;
  getToken: Token;
  disabled: boolean;
  committed: { current: Set<string> };
}) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const reservations = useRef(new Map<string, string>());
  const cancelled = useRef(new Set<string>());
  const mounted = useRef(true);
  const queue = useRef<DraftAttachment[]>([]);
  const running = useRef(0);
  const queued = useRef(new Set<string>());
  const pendingIds = items
    .filter(
      (item) =>
        item.id &&
        item.uploaded !== false &&
        ['awaiting_upload', 'processing'].includes(item.state),
    )
    .map((item) => item.id)
    .join(',');
  useEffect(() => {
    mounted.current = true;
    const current = requests.current,
      reserved = reservations.current,
      accepted = committed.current;
    return () => {
      mounted.current = false;
      queue.current = [];
      for (const xhr of current.values()) xhr.abort();
      // Attached files reject this endpoint; only abandoned reservations are removed.
      for (const [id, token] of reserved)
        if (!accepted.has(id))
          void dreamApi(`/uploads/${id}`, token, { method: 'DELETE' }).catch(() => {});
    };
  }, [committed]);
  useEffect(() => {
    if (!pendingIds) return;
    const controller = new AbortController();
    let busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const token = await getToken();
        const rows = await Promise.all(
          pendingIds
            .split(',')
            .map((id) =>
              dreamApi<DreamAttachment>(`/uploads/${id}`, token, { signal: controller.signal }),
            ),
        );
        if (!controller.signal.aborted)
          setItems((previous) =>
            previous.map((item) => ({ ...item, ...rows.find((row) => row.id === item.id) })),
          );
      } catch {
        /* Keep current status; transient reads retry on the next interval. */
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => void poll(), 8000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [pendingIds, getToken, setItems]);

  async function upload(item: DraftAttachment) {
    if (!item.file || !item.localId || cancelled.current.has(item.localId) || !mounted.current)
      return;
    const localId = item.localId;
    const update = (changes: Partial<DraftAttachment>) =>
      setItems((previous) =>
        previous.map((row) => (row.localId === localId ? { ...row, ...changes } : row)),
      );
    update({ uploaded: false, uploadError: undefined, progress: 0 });
    try {
      const token = await getToken();
      // A retry reserves a new immutable input instead of overwriting old bytes.
      let reservation = item.id
        ? null
        : await dreamApi<{ id: string; uploadUrl: string; uploadHeaders: Record<string, string> }>(
            '/uploads',
            token,
            {
              method: 'POST',
              body: { kind: item.kind, contentType: item.file.type, bytes: item.file.size },
            },
          );
      if (!reservation) {
        // Upload URLs expire; selecting a fresh reservation avoids an overwritten input.
        if (item.id) await dreamApi(`/uploads/${item.id}`, token, { method: 'DELETE' });
        reservation = await dreamApi('/uploads', token, {
          method: 'POST',
          body: { kind: item.kind, contentType: item.file.type, bytes: item.file.size },
        });
      }
      const reserved = reservation!;
      reservations.current.set(reserved.id, token!);
      if (cancelled.current.has(localId) || !mounted.current) {
        await dreamApi(`/uploads/${reserved.id}`, token, { method: 'DELETE' });
        reservations.current.delete(reserved.id);
        return;
      }
      update({ id: reserved.id, state: 'awaiting_upload' });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        requests.current.set(localId, xhr);
        xhr.open('PUT', reserved.uploadUrl);
        for (const [key, value] of Object.entries(reserved.uploadHeaders))
          xhr.setRequestHeader(key, value);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable)
            update({ progress: Math.round((event.loaded / event.total) * 100) });
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('UPLOAD_FAILED'));
        xhr.onerror = () => reject(new Error('UPLOAD_FAILED'));
        xhr.onabort = () => reject(new Error('UPLOAD_ABORTED'));
        xhr.send(item.file);
      });
      update({ uploaded: true, progress: 100 });
    } catch (reason) {
      update({
        uploadError:
          reason instanceof Error && reason.message.startsWith('UPLOAD_')
            ? 'post.uploadFailed'
            : dreamErrorKey(reason),
      });
    } finally {
      requests.current.delete(localId);
    }
  }
  function enqueue(items: DraftAttachment[]) {
    const fresh = items.filter((item) => item.localId && !queued.current.has(item.localId));
    for (const item of fresh) queued.current.add(item.localId!);
    setItems((previous) =>
      previous.map((item) =>
        fresh.some((row) => row.localId === item.localId)
          ? { ...item, uploadError: undefined }
          : item,
      ),
    );
    queue.current.push(...fresh);
    const drain = () => {
      while (mounted.current && running.current < 2 && queue.current.length) {
        const item = queue.current.shift()!;
        running.current++;
        void upload(item).finally(() => {
          queued.current.delete(item.localId!);
          running.current--;
          drain();
        });
      }
    };
    drain();
  }
  function select(files: FileList | null) {
    setError('');
    if (!files) return;
    if (items.length + files.length > 25) {
      setError('post.tooManyAttachments');
      return;
    }
    const selected = Array.from(files);
    if (
      selected.some(
        (file) =>
          !['image/jpeg', 'image/png', 'video/mp4'].includes(file.type) ||
          file.size < 1 ||
          file.size > (file.type === 'video/mp4' ? 200 : 10) * 1024 ** 2,
      )
    ) {
      setError('post.invalidAttachment');
      return;
    }
    const rows: DraftAttachment[] = selected.map((file) => ({
      id: '',
      localId: dreamRequestKey(),
      file,
      kind: file.type === 'video/mp4' ? 'video' : 'image',
      state: 'awaiting_upload',
      bytes: file.size,
      width: null,
      height: null,
      duration: null,
      error: null,
      uploaded: false,
      progress: 0,
    }));
    setItems((previous) => [...previous, ...rows]);
    enqueue(rows);
  }
  function remove(item: DraftAttachment) {
    if (item.localId) cancelled.current.add(item.localId);
    if (item.localId) requests.current.get(item.localId)?.abort();
    setItems((previous) =>
      previous.filter((row) => (row.localId || row.id) !== (item.localId || item.id)),
    );
    if (item.id && item.localId)
      void getToken()
        .then((token) => dreamApi(`/uploads/${item.id}`, token, { method: 'DELETE' }))
        .then(() => reservations.current.delete(item.id))
        .catch(() => {});
  }
  return (
    <div className="dream-attachments-editor">
      <label className="button secondary dream-attach-button">
        <ImagePlus size={18} aria-hidden="true" />
        {t('post.attach')}
        <input
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,video/mp4"
          multiple
          disabled={disabled || items.length >= 25}
          onChange={(event) => {
            select(event.target.files);
            event.target.value = '';
          }}
        />
      </label>
      <p className="dream-helper">{t('post.attachmentLimits')}</p>
      {items.length > 0 && (
        <p className="dream-helper">
          {t('post.attachmentCount', { count: items.length, limit: 25 })}
        </p>
      )}
      {error && (
        <p className="dream-notice" role="alert">
          {t(error)}
        </p>
      )}
      <ul className="dream-upload-list">
        {items.map((item, index) => (
          <li key={item.localId || item.id}>
            <div>
              <strong>
                {item.file?.name ||
                  t(item.kind === 'image' ? 'post.photo' : 'post.video', { index: index + 1 })}
              </strong>
              <p role="status">
                {t(
                  item.uploadError ||
                    (item.uploaded === false
                      ? 'post.uploading'
                      : item.state === 'ready'
                        ? 'post.ready'
                        : item.state === 'failed'
                          ? 'post.failed'
                          : 'post.processing'),
                  { progress: item.progress ?? 0 },
                )}
              </p>
              {item.uploadError && (
                <button
                  className="button secondary compact"
                  type="button"
                  disabled={disabled}
                  onClick={() => enqueue([item])}
                >
                  {t('post.retryUpload')}
                </button>
              )}
            </div>
            <button
              className="dream-remove-attachment"
              type="button"
              disabled={disabled}
              aria-label={t('post.removeAttachment', { index: index + 1 })}
              onClick={() => remove(item)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Session = {
  token: string;
  expiresIn: number;
  media: { id: string; url: string; thumbnail: string }[];
};

function DreamMediaPreview({
  thumbnail,
  loading,
  visible,
  onSettled,
}: {
  thumbnail?: string;
  loading: boolean;
  visible: boolean;
  onSettled?: () => void;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState('');
  return (
    <div
      className="dream-media-preview"
      data-loading={loading}
      data-visible={visible}
      aria-hidden={!loading}
      role="status"
      aria-label={t('common.loading')}
    >
      {thumbnail && failed !== thumbnail && (
        <img
          src={thumbnail}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={onSettled}
          onError={() => {
            setFailed(thumbnail);
            onSettled?.();
          }}
        />
      )}
    </div>
  );
}

function DreamMediaAttachment({
  attachment,
  index,
  source,
  onError,
  onOpen,
  pausePlayback = false,
  initialTime = 0,
  autoPlay = false,
}: {
  attachment: DreamAttachment;
  index: number;
  source?: Session['media'][number];
  onError: () => void;
  onOpen?: (time: number, playing: boolean) => void;
  pausePlayback?: boolean;
  initialTime?: number;
  autoPlay?: boolean;
}) {
  const { t } = useI18n();
  const figure = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState('');
  const [metadata, setMetadata] = useState('');
  const [poster, setPoster] = useState('');
  const [buffering, setBuffering] = useState('');
  const progress = useRef<{ url: string; time: number } | null>(null);
  const ready = Boolean(source && loaded === source.url);
  const video = attachment.kind === 'video';
  const waiting = Boolean(source && buffering === source.url);
  const loading =
    !source ||
    (video
      ? (!ready && (metadata !== source.url || poster !== source.thumbnail)) || waiting
      : !ready);
  const preview = (
    <DreamMediaPreview
      thumbnail={video || loading ? source?.thumbnail : undefined}
      loading={loading}
      visible={!ready || waiting}
      onSettled={() => source && setPoster(source.thumbnail)}
    />
  );
  const videoReady = () => {
    if (!source) return;
    setLoaded(source.url);
    setBuffering('');
  };
  const open = () => {
    const element = figure.current?.querySelector('video');
    onOpen?.(element?.currentTime ?? 0, Boolean(element && !element.paused));
  };
  return (
    <figure
      ref={figure}
      className="dream-media-attachment"
      data-attachment-id={attachment.id}
      aria-busy={loading}
      aria-label={video ? t('post.video', { index: index + 1 }) : undefined}
    >
      {video && source ? (
        <MediaPlayer
          key={source.url}
          src={source.url}
          loadingOverlay={preview}
          pauseWhenOffscreen
          pausePlayback={pausePlayback}
          initialTime={initialTime}
          autoPlay={autoPlay}
          hideFullscreen={Boolean(onOpen)}
          onLoadedMetadata={() => setMetadata(source.url)}
          onLoadedData={videoReady}
          onCanPlay={videoReady}
          onWaiting={() => {
            const element = figure.current?.querySelector('video');
            progress.current = { url: source.url, time: element?.currentTime ?? 0 };
            setBuffering(source.url);
          }}
          onPlaying={videoReady}
          onPlaybackProgress={(element) => {
            const previous = progress.current;
            progress.current = { url: source.url, time: element.currentTime };
            if (
              (waiting || !ready) &&
              !element.paused &&
              !element.seeking &&
              previous?.url === source.url &&
              element.currentTime > previous.time
            )
              videoReady();
          }}
          onError={onError}
        />
      ) : (
        <div
          className="dream-media-frame"
          style={{
            aspectRatio: video ? '16 / 9' : `${attachment.width || 16} / ${attachment.height || 9}`,
          }}
        >
          {preview}
          {!video && source && (
            <img
              className="dream-media-image"
              data-ready={ready}
              src={source.url}
              alt={t('post.photo', { index: index + 1 })}
              width={attachment.width || undefined}
              height={attachment.height || undefined}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={(event) => {
                const image = event.currentTarget;
                void image
                  .decode()
                  .catch(() => {})
                  .then(() => setLoaded(source.url));
              }}
              onError={onError}
            />
          )}
          {!video && source && onOpen && (
            <button
              className="dream-media-open"
              type="button"
              aria-label={`${t('chat.openImagePreview')}: ${t('post.photo', { index: index + 1 })}`}
              onClick={open}
            />
          )}
        </div>
      )}
      {video && source && onOpen && (
        <button
          className="dream-media-expand"
          type="button"
          aria-label={t('media.enterFullscreen')}
          onClick={open}
        >
          <Maximize size={19} aria-hidden="true" />
        </button>
      )}
    </figure>
  );
}

function DreamCompactVideo({
  attachment,
  index,
  source,
  onOpen,
}: {
  attachment: DreamAttachment;
  index: number;
  source?: Session['media'][number];
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const [settled, setSettled] = useState('');
  const loading = !source || settled !== source.thumbnail;
  return (
    <figure
      className="dream-media-attachment dream-media-video-tile"
      data-attachment-id={attachment.id}
      aria-busy={loading}
    >
      <div className="dream-media-frame">
        <DreamMediaPreview
          thumbnail={source?.thumbnail}
          loading={loading}
          visible
          onSettled={() => source && setSettled(source.thumbnail)}
        />
        {source && (
          <button
            className="dream-media-video-open"
            type="button"
            aria-label={`${t('common.play')}: ${t('post.video', { index: index + 1 })}`}
            onClick={onOpen}
          >
            <span aria-hidden="true">
              <Play size={22} fill="currentColor" />
            </span>
          </button>
        )}
      </div>
    </figure>
  );
}

type GalleryEntry = {
  attachment: DreamAttachment;
  source: Session['media'][number];
  index: number;
};
type GallerySelection = { id: string; time: number; playing: boolean };

function rememberViewerPosition(
  dialog: HTMLDialogElement | null,
  save: (id: string, time: number) => void,
) {
  const video = dialog?.querySelector('video');
  const id = video?.closest<HTMLElement>('[data-attachment-id]')?.dataset.attachmentId;
  if (video && video.readyState >= 1 && id) save(id, video.currentTime);
}

function DreamMediaViewer({
  entries,
  selection,
  onSelect,
  onClose,
  onPosition,
  onError,
}: {
  entries: GalleryEntry[];
  selection: GallerySelection;
  onSelect: (selection: GallerySelection) => void;
  onClose: () => void;
  onPosition: (id: string, time: number) => void;
  onError: () => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const positions = useRef(new Map<string, number>());
  const current = entries.findIndex((entry) => entry.attachment.id === selection.id);
  const entry = entries[current];
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    close.current?.focus();
    const nativeBack = (event: Event) => {
      if (!element.open) return;
      event.preventDefault();
      rememberViewerPosition(element, onPosition);
      onClose();
    };
    window.addEventListener('app-back', nativeBack);
    return () => {
      window.removeEventListener('app-back', nativeBack);
      if (element.open) element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onClose, onPosition]);
  if (!entry || typeof document === 'undefined') return null;
  const dismiss = () => {
    rememberViewerPosition(dialog.current, onPosition);
    onClose();
  };
  const navigate = (offset: number) => {
    const next = entries[current + offset];
    if (!next) return;
    rememberViewerPosition(dialog.current, (id, time) => {
      positions.current.set(id, time);
      onPosition(id, time);
    });
    onSelect({
      id: next.attachment.id,
      time: positions.current.get(next.attachment.id) ?? 0,
      playing: false,
    });
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="dream-media-viewer"
      aria-label={t(entry.attachment.kind === 'image' ? 'post.photo' : 'post.video', {
        index: entry.index + 1,
      })}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest('input,textarea,select,[contenteditable="true"],[role="slider"]')) {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            navigate(-1);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            navigate(1);
          }
        }
        if (event.key !== 'Tab') return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
          ),
        ].filter((item) => item.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className="dream-viewer-toolbar">
        <p aria-live="polite">
          {t('post.attachmentCount', { count: current + 1, limit: entries.length })}
        </p>
        <button
          ref={close}
          className="dream-viewer-control"
          type="button"
          aria-label={t('chat.dismiss')}
          onClick={dismiss}
        >
          <X size={23} aria-hidden="true" />
        </button>
      </header>
      <div
        className="dream-viewer-stage"
        onClick={(event) => {
          if (event.target === event.currentTarget) dismiss();
        }}
        onTouchStart={(event) => {
          touch.current = null;
          if (
            event.touches.length !== 1 ||
            (window.visualViewport?.scale ?? 1) > 1 ||
            (event.target as HTMLElement).closest('button,input')
          )
            return;
          touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchEnd={(event) => {
          const start = touch.current;
          touch.current = null;
          if (!start || !event.changedTouches.length) return;
          const dx = event.changedTouches[0].clientX - start.x,
            dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? 1 : -1);
        }}
        onTouchCancel={() => {
          touch.current = null;
        }}
      >
        {entries.length > 1 && (
          <button
            className="dream-viewer-control dream-viewer-previous"
            type="button"
            aria-label={t('tour.back')}
            disabled={current === 0}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={25} aria-hidden="true" />
          </button>
        )}
        <div className="dream-viewer-content">
          <DreamMediaAttachment
            key={entry.attachment.id}
            attachment={entry.attachment}
            index={entry.index}
            source={entry.source}
            initialTime={selection.time}
            autoPlay={selection.playing}
            onError={onError}
          />
        </div>
        {entries.length > 1 && (
          <button
            className="dream-viewer-control dream-viewer-next"
            type="button"
            aria-label={t('tour.next')}
            disabled={current === entries.length - 1}
            onClick={() => navigate(1)}
          >
            <ChevronRight size={25} aria-hidden="true" />
          </button>
        )}
      </div>
    </dialog>,
    document.body,
  );
}

export function DreamMedia({
  dreamId,
  revision,
  attachments,
  getToken,
  active = true,
}: {
  dreamId: string;
  revision: number;
  attachments: DreamAttachment[];
  getToken: Token;
  active?: boolean;
}) {
  const { t } = useI18n();
  const [media, setMedia] = useState<Session['media']>([]);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [selection, setSelection] = useState<GallerySelection | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const closeViewer = useCallback(() => setSelection(null), []);
  const savePosition = useCallback((id: string, time: number) => {
    const figure = [
      ...(grid.current?.querySelectorAll<HTMLElement>('[data-attachment-id]') ?? []),
    ].find((item) => item.dataset.attachmentId === id);
    const video = figure?.querySelector('video');
    if (video && video.readyState >= 1 && Number.isFinite(time)) video.currentTime = time;
  }, []);
  const available = attachments
    .filter((item) => item.state === 'ready')
    .map((item) => item.id)
    .join(',');
  useEffect(() => {
    if (!available || !active) return;
    const controller = new AbortController();
    let token: string | undefined,
      pending = false;
    const renew = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await dreamApi<Session>(`/${dreamId}/media-session`, await getToken(), {
          method: 'POST',
          body: token ? { token } : {},
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          token = result.token;
          setMedia(result.media);
          setSelection((previous) =>
            previous && result.media.some((item) => item.id === previous.id) ? previous : null,
          );
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) {
          setMedia([]);
          setSelection(null);
          setError('post.mediaUnavailable');
        }
      } finally {
        pending = false;
      }
    };
    void renew();
    const timer = window.setInterval(() => void renew(), 120_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [dreamId, revision, available, getToken, version, active]);
  const entries: GalleryEntry[] = attachments.flatMap((attachment, index) => {
    const source = media.find((item) => item.id === attachment.id);
    return attachment.state === 'ready' && source ? [{ attachment, source, index }] : [];
  });
  const viewing = Boolean(
    !error && selection && entries.some((item) => item.attachment.id === selection.id),
  );
  const mediaError = () => {
    setError('post.mediaUnavailable');
    setSelection(null);
  };
  const visible = attachments.slice(0, 5);
  const remaining = Math.max(0, attachments.length - visible.length);
  const overflowTarget = entries.find((entry) => entry.index >= 4);
  return (
    <div ref={grid} className="dream-media-grid" data-count={error ? 1 : visible.length}>
      {!error &&
        visible.map((attachment, index) => {
          const source = media.find((item) => item.id === attachment.id);
          const obscured = index === 4 && remaining > 0;
          return (
            <div className="dream-media-tile" key={attachment.id}>
              <div
                className="dream-media-tile-content"
                inert={obscured}
                aria-hidden={obscured || undefined}
              >
                {attachment.state === 'ready' &&
                attachment.kind === 'video' &&
                visible.length > 1 ? (
                  <DreamCompactVideo
                    attachment={attachment}
                    index={index}
                    source={source}
                    onOpen={() => setSelection({ id: attachment.id, time: 0, playing: true })}
                  />
                ) : attachment.state === 'ready' ? (
                  <DreamMediaAttachment
                    attachment={attachment}
                    index={index}
                    source={source}
                    onError={mediaError}
                    pausePlayback={viewing || obscured || !active}
                    onOpen={
                      source
                        ? (time, playing) => setSelection({ id: attachment.id, time, playing })
                        : undefined
                    }
                  />
                ) : (
                  <p className="dream-helper" role="status">
                    {t(attachment.state === 'failed' ? 'post.failed' : 'post.processing')}
                  </p>
                )}
              </div>
              {obscured && (
                <button
                  className="dream-media-overflow"
                  type="button"
                  disabled={!overflowTarget}
                  aria-label={`${t('media.enterFullscreen')}: ${t('post.mediaOnly', { count: attachments.length })} (+${remaining})`}
                  onClick={() => {
                    if (!overflowTarget) return;
                    const figure = [
                      ...(grid.current?.querySelectorAll<HTMLElement>('[data-attachment-id]') ??
                        []),
                    ].find((item) => item.dataset.attachmentId === overflowTarget.attachment.id);
                    const video = figure?.querySelector('video');
                    setSelection({
                      id: overflowTarget.attachment.id,
                      time: video?.currentTime ?? 0,
                      playing: Boolean(video && !video.paused),
                    });
                  }}
                >
                  <span aria-hidden="true">+{remaining}</span>
                </button>
              )}
            </div>
          );
        })}
      {viewing && selection && (
        <DreamMediaViewer
          entries={entries}
          selection={selection}
          onSelect={setSelection}
          onClose={closeViewer}
          onPosition={savePosition}
          onError={mediaError}
        />
      )}
      {error && (
        <div className="dream-notice" role="alert">
          <p>{t(error)}</p>
          <button
            className="button secondary compact"
            type="button"
            onClick={() => setVersion((value) => value + 1)}
          >
            {t('common.retry')}
          </button>
        </div>
      )}
    </div>
  );
}

export function DreamCleanup({ operationId, getToken }: { operationId: string; getToken: Token }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [operationId]);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false,
      done = false;
    const poll = async () => {
      if (busy || done) return;
      busy = true;
      try {
        const result = await dreamApi<{ state: string; error: string | null }>(
          `/operations/${encodeURIComponent(operationId)}`,
          await getToken(),
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          done = result.state === 'complete';
          if (done) window.clearInterval(timer);
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          done = reason instanceof DreamApiError && reason.status === 404;
          if (done) window.clearInterval(timer);
        }
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => void poll(), 15_000);
    void poll();
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [operationId, getToken]);
  if (!visible) return null;
  return (
    <p className="dream-notice" role="status">
      {t('post.deleted')}
    </p>
  );
}
