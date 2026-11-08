import { Capacitor } from '@capacitor/core';

export type DreamAudience = 'public' | 'friends' | 'only_me';
export type DreamVotes = { up: number; down: number; viewerVote: -1 | 0 | 1 };
export type DreamAttachment = {
  id: string;
  kind: 'image' | 'video';
  state: 'awaiting_upload' | 'processing' | 'ready' | 'failed';
  bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  error: string | null;
};
export type Dream = {
  id: string;
  authorId: string;
  authorName: string | null;
  authorAvatarUrl?: string | null;
  text: string;
  audience: DreamAudience;
  publication: 'draft' | 'processing' | 'published' | 'failed';
  attachments?: DreamAttachment[];
  hasPublishedVersion?: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  votes?: DreamVotes;
};
export class DreamApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function dreamHref(id: string) {
  return `/ambatupost/?dream=${encodeURIComponent(id)}`;
}
export function dreamRequestKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
export function dreamErrorKey(error: unknown) {
  if (!(error instanceof DreamApiError)) return 'post.error';
  if (['INVALID_FEED_CURSOR', 'FEED_CURSOR_EXPIRED'].includes(error.code))
    return 'post.feedExpired';
  if (error.code === 'UPLOAD_QUOTA') return 'post.uploadQuota';
  if (error.code === 'INVALID_ATTACHMENT' || error.code === 'INVALID_ATTACHMENTS')
    return 'post.invalidAttachment';
  if (error.code === 'ATTACHMENT_RESELECT') return 'post.reselectAttachment';
  if (error.code === 'MEDIA_UNAVAILABLE') return 'post.mediaUnavailable';
  if (error.code === 'REVISION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT')
    return 'post.conflict';
  if (error.code === 'INVALID_DREAM' || error.code === 'BODY_TOO_LARGE') return 'post.invalid';
  if (error.status === 401 || error.code === 'ACCOUNT_UNAVAILABLE') return 'post.signInAgain';
  if (error.status === 429) return 'post.rateLimited';
  if (error.code === 'MODULE_UNAVAILABLE') return 'post.disabled';
  if (error.status === 404 || error.status === 410) return 'post.unavailable';
  return 'post.error';
}
export async function dreamApi<T>(
  path: string,
  token: string | null,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    key?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '');
  if (!base) throw new DreamApiError('DREAM_SERVICE_UNAVAILABLE', 503);
  const method = options.method ?? 'GET';
  // Match video management: web writes use the same-origin Next proxy;
  // native exports have no Next server and use the configured API with CORS.
  const endpoint =
    method !== 'GET' && !Capacitor.isNativePlatform()
      ? '/api/public/ambatupost'
      : `${base}/ambatupost`;
  const response = await fetch(`${endpoint}${path}`, {
    method,
    cache: 'no-store',
    signal: options.signal,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options.key ? { 'idempotency-key': options.key } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new DreamApiError(
      typeof payload.error === 'string' ? payload.error : 'DREAM_SERVICE_UNAVAILABLE',
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
