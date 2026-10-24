const profileAvatarCache = 'ambatu-profile-avatars-v1';
const maxCachedProfileAvatars = 24;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.destination !== 'image' || !url.pathname.includes('/profile-avatars/')) return;

  url.search = '';
  url.hash = '';
  const cacheKey = url.href;
  event.respondWith((async () => {
    const cache = await caches.open(profileAvatarCache);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        try {
          await cache.put(cacheKey, response.clone());
          const keys = await cache.keys();
          if (keys.length > maxCachedProfileAvatars) {
            await Promise.all(keys.slice(0, keys.length - maxCachedProfileAvatars).map(key => cache.delete(key)));
          }
        } catch { /* Keep the image usable when local storage is unavailable or full. */ }
      }
      return response;
    } catch {
      return await cache.match(cacheKey) ?? Response.error();
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;
  const url = event.notification.data?.url;
  const target = url === '/friends/' ? '/friends/' : conversationId ? `/chat/?conversation=${encodeURIComponent(conversationId)}` : '/chat/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => 'focus' in client);
    if (!existing) return self.clients.openWindow(target);
    return existing.navigate(target).then(client => (client ?? existing).focus());
  }));
});

if (new URL(self.location.href).searchParams.get('cacheOnly') !== '1') {
  importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
  importScripts('/firebase-push-config.js');

  firebase.initializeApp(self.ambatuFirebaseConfig);
  firebase.messaging();
}
