import type { ChatConversation, ChatMessage } from './chat';

const databaseName = 'ambatuchat-cache';
const databaseVersion = 1;
const conversationStoreName = 'conversations';
const messageStoreName = 'messages';
const maxCachedMessagesPerConversation = 300;
const mediaUrlLifetimeMs = 55 * 60 * 1000;

type CachedConversation = ChatConversation & { userId: string };
type CachedMessage = ChatMessage & { userId: string; cacheKey: string; mediaUrlExpiresAt?: number };

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
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return databasePromise;
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
  const transaction = database.transaction([conversationStoreName, messageStoreName], 'readwrite');
  transaction.objectStore(conversationStoreName).delete([userId, conversationId]);
  const range = IDBKeyRange.only([userId, conversationId]);
  const request = transaction.objectStore(messageStoreName).index('by-user-conversation').openKeyCursor(range);
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
  await transactionFinished(transaction);
}
