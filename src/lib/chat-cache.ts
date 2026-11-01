import type { ChatConversation, ChatMessage } from './chat';

const databaseName = 'ambatuchat-cache';
const databaseVersion = 3;
const conversationStoreName = 'conversations';
const messageStoreName = 'messages';
const avatarStoreName = 'avatars';
const mediaStoreName = 'media';
const maxCachedMessagesPerConversation = 300;
const mediaUrlLifetimeMs = 55 * 60 * 1000;
export const maxChatMediaBytes = 5 * 1024 * 1024;
const maxCachedMediaBytesPerUser = 100 * 1024 * 1024;

type CachedConversation = ChatConversation & { userId: string };
type CachedMessage = ChatMessage & { userId: string; cacheKey: string; mediaUrlExpiresAt?: number };
export type CachedChatAvatar = { id: string; url: string; expiresAt: number };
type CachedMedia = { userId: string; conversationId: string; key: string; blob: Blob; size: number; lastAccessed: number };

let databasePromise: Promise<IDBDatabase | null> | null = null;

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise(resolve => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(conversationStoreName)) {
        const conversations = database.createObjectStore(conversationStoreName, { keyPath: ['userId', 'id'] });
        conversations.createIndex('by-user', 'userId');
      }
      if (!database.objectStoreNames.contains(messageStoreName)) {
        const messages = database.createObjectStore(messageStoreName, { keyPath: ['userId', 'conversationId', 'cacheKey'] });
        messages.createIndex('by-user-conversation', ['userId', 'conversationId']);
      }
      if (!database.objectStoreNames.contains(avatarStoreName)) {
        const avatars = database.createObjectStore(avatarStoreName, { keyPath: ['userId', 'id'] });
        avatars.createIndex('by-user', 'userId');
      }
      if (!database.objectStoreNames.contains(mediaStoreName)) {
        const media = database.createObjectStore(mediaStoreName, { keyPath: ['userId', 'conversationId', 'key'] });
        media.createIndex('by-user', 'userId');
        media.createIndex('by-user-conversation', ['userId', 'conversationId']);
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => { database.close(); databasePromise = null; };
      resolve(database);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return databasePromise;
}

export function avatarUrlExpiresAt(url: string, now = Date.now()) {
  try {
    const parsed = new URL(url);
    const date = parsed.searchParams.get('X-Amz-Date');
    const seconds = Number(parsed.searchParams.get('X-Amz-Expires'));
    const match = date?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (match && Number.isFinite(seconds) && seconds > 0) {
      const signedAt = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
      return Math.min(now + mediaUrlLifetimeMs, signedAt + seconds * 1000 - 60_000);
    }
  } catch { /* An invalid URL is discarded below. */ }
  return now;
}

export function selectChatAvatar(id: string, url: string, previous: CachedChatAvatar | undefined, now = Date.now()): CachedChatAvatar | null {
  const expiresAt = avatarUrlExpiresAt(url, now);
  try {
    const next = new URL(url);
    if (next.protocol !== 'https:' && next.protocol !== 'http:') return null;
    if (previous && previous.expiresAt > now + 60_000) {
      const old = new URL(previous.url);
      if (old.origin === next.origin && old.pathname === next.pathname) return previous;
    }
    return expiresAt > now ? { id, url, expiresAt } : null;
  } catch { return null; }
}

export async function loadCachedChatAvatars(userId: string) {
  const database = await openDatabase();
  if (!database) return [];
  const transaction = database.transaction(avatarStoreName, 'readonly');
  const records = await requestResult(transaction.objectStore(avatarStoreName).index('by-user').getAll(IDBKeyRange.only(userId))) as (CachedChatAvatar & { userId: string })[];
  return records.filter(record => record.expiresAt > Date.now()).map(stripUserId);
}

export async function saveCachedChatAvatars(userId: string, ids: string[], avatars: Record<string, CachedChatAvatar>) {
  if (!ids.length) return;
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(avatarStoreName, 'readwrite');
  const store = transaction.objectStore(avatarStoreName);
  for (const id of ids) {
    const avatar = avatars[id];
    if (avatar) store.put({ ...avatar, userId });
    else store.delete([userId, id]);
  }
  await transactionFinished(transaction);
}

export async function loadCachedChatMedia(userId: string, conversationId: string, key: string): Promise<Blob | null> {
  const database = await openDatabase();
  if (!database) return null;
  const transaction = database.transaction(mediaStoreName, 'readwrite');
  const store = transaction.objectStore(mediaStoreName);
  const record = await requestResult(store.get([userId, conversationId, key])) as CachedMedia | undefined;
  if (record) store.put({ ...record, lastAccessed: Date.now() });
  await transactionFinished(transaction);
  return record?.blob ?? null;
}

export async function saveCachedChatMedia(userId: string, conversationId: string, key: string, blob: Blob) {
  if (!blob.size || blob.size > maxChatMediaBytes) return;
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(mediaStoreName, 'readwrite');
  const store = transaction.objectStore(mediaStoreName);
  const request = store.index('by-user').getAll(IDBKeyRange.only(userId));
  request.onsuccess = () => {
    const existing = (request.result as CachedMedia[]).filter(record => record.conversationId !== conversationId || record.key !== key);
    let bytes = existing.reduce((sum, record) => sum + record.size, blob.size);
    existing.sort((a, b) => a.lastAccessed - b.lastAccessed);
    for (const record of existing) {
      if (bytes <= maxCachedMediaBytesPerUser) break;
      store.delete([userId, record.conversationId, record.key]);
      bytes -= record.size;
    }
    store.put({ userId, conversationId, key, blob, size: blob.size, lastAccessed: Date.now() } satisfies CachedMedia);
  };
  await transactionFinished(transaction);
}

function transactionFinished(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function stripUserId<T extends { userId: string }>(record: T): Omit<T, 'userId'> {
  const copy = { ...record };
  Reflect.deleteProperty(copy, 'userId');
  return copy;
}

function stripMessageCacheFields(record: CachedMessage): ChatMessage {
  const copy: Record<string, unknown> = { ...record };
  Reflect.deleteProperty(copy, 'userId');
  Reflect.deleteProperty(copy, 'cacheKey');
  return copy as ChatMessage;
}

export async function loadCachedConversations(userId: string) {
  const database = await openDatabase();
  if (!database) return [];
  const transaction = database.transaction(conversationStoreName, 'readonly');
  const records = await requestResult(transaction.objectStore(conversationStoreName).index('by-user').getAll(IDBKeyRange.only(userId))) as CachedConversation[];
  return records.sort((a, b) => b.updatedAt - a.updatedAt).map(stripUserId);
}

export async function saveCachedConversations(userId: string, conversations: ChatConversation[]) {
  if (!conversations.length) return;
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(conversationStoreName, 'readwrite');
  const store = transaction.objectStore(conversationStoreName);
  conversations.forEach(conversation => store.put({ ...conversation, userId } satisfies CachedConversation));
  await transactionFinished(transaction);
}

// A cursorless first page is the complete inbox and can remove stale entries.
export async function replaceCachedConversations(userId: string, conversations: ChatConversation[]) {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(conversationStoreName, 'readwrite');
  const store = transaction.objectStore(conversationStoreName);
  const retained = new Set(conversations.map(conversation => conversation.id));
  const request = store.index('by-user').openCursor(IDBKeyRange.only(userId));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    if (!retained.has((cursor.value as CachedConversation).id)) cursor.delete();
    cursor.continue();
  };
  conversations.forEach(conversation => store.put({ ...conversation, userId } satisfies CachedConversation));
  await transactionFinished(transaction);
}

export async function loadCachedMessages(userId: string, conversationId: string) {
  const database = await openDatabase();
  if (!database) return [];
  const transaction = database.transaction(messageStoreName, 'readonly');
  const records = await requestResult(transaction.objectStore(messageStoreName).index('by-user-conversation').getAll(IDBKeyRange.only([userId, conversationId]))) as CachedMessage[];
  return records
    .sort((a, b) => a.createdAt - b.createdAt || (a.messageKey ?? a.id).localeCompare(b.messageKey ?? b.id))
    .map(stripMessageCacheFields);
}

export async function saveCachedMessages(userId: string, conversationId: string, messages: ChatMessage[]) {
  if (!messages.length) return;
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(messageStoreName, 'readwrite');
  const store = transaction.objectStore(messageStoreName);
  const now = Date.now();
  messages.forEach(message => {
    if (message.conversationId !== conversationId) return;
    const cacheKey = message.messageKey || message.id;
    const mediaUrlExpiresAt = message.key && message.url
      ? message.mediaUrlExpiresAt ?? now + mediaUrlLifetimeMs
      : undefined;
    store.put({ ...message, ...(mediaUrlExpiresAt ? { mediaUrlExpiresAt } : {}), userId, cacheKey } satisfies CachedMessage);
  });

  const range = IDBKeyRange.only([userId, conversationId]);
  const request = store.index('by-user-conversation').getAll(range);
  request.onsuccess = () => {
    const cached = request.result as CachedMessage[];
    cached.sort((a, b) => b.createdAt - a.createdAt || (b.messageKey ?? b.id).localeCompare(a.messageKey ?? a.id));
    cached.slice(maxCachedMessagesPerConversation).forEach(message => {
      store.delete([userId, conversationId, message.cacheKey]);
    });
  };
  await transactionFinished(transaction);
}

export async function deleteCachedConversation(userId: string, conversationId: string) {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction([conversationStoreName, messageStoreName, mediaStoreName], 'readwrite');
  transaction.objectStore(conversationStoreName).delete([userId, conversationId]);
  const range = IDBKeyRange.only([userId, conversationId]);
  const request = transaction.objectStore(messageStoreName).index('by-user-conversation').openCursor(range);
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
  const mediaRequest = transaction.objectStore(mediaStoreName).index('by-user-conversation').openCursor(range);
  mediaRequest.onsuccess = () => {
    const cursor = mediaRequest.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
  await transactionFinished(transaction);
}
