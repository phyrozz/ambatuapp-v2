self.addEventListener('notificationclick', event => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;
  const target = conversationId ? `/chat/?conversation=${encodeURIComponent(conversationId)}` : '/chat/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => 'focus' in client);
    if (!existing) return self.clients.openWindow(target);
    return existing.navigate(target).then(client => (client ?? existing).focus());
  }));
});

importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
importScripts('/firebase-push-config.js');

firebase.initializeApp(self.ambatuFirebaseConfig);
firebase.messaging();
