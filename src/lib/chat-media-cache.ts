import { maxChatMediaBytes, saveCachedChatMedia } from './chat-cache';

const pending = new Map<string, Promise<Blob | null>>();

// Concurrent renders of the same attachment share one download.
export function downloadChatMedia(userId: string, conversationId: string, key: string, url: string, kind: 'image' | 'video') {
  const identity = JSON.stringify([userId, conversationId, key]);
  const existing = pending.get(identity);
  if (existing) return existing;
  const request = (async () => {
    try {
      const response = await fetch(url, { credentials: 'omit' });
      if (!response.ok) return null;
      const length = Number(response.headers.get('content-length'));
      if (length > maxChatMediaBytes) return null;
      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
      if (!contentType.startsWith(`${kind}/`)) return null;
      const blob = await response.blob();
      if (!blob.size || blob.size > maxChatMediaBytes) return null;
      await saveCachedChatMedia(userId, conversationId, key, blob).catch(() => {});
      return blob;
    } catch {
      return null;
    }
  })().finally(() => pending.delete(identity));
  pending.set(identity, request);
  return request;
}
