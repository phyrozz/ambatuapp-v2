import { Capacitor } from '@capacitor/core';
import type { ChatSocket } from './chat';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
let navigationInstalled = false;
let activeLocale = 'en';
let activeUserId: string | null = null;
let activeNavigate: (url: string) => void = () => undefined;

function goToConversation(conversationId: string | undefined, navigate: (url: string) => void) {
  if (!conversationId || typeof window === 'undefined') return;
  navigate(`/chat/?conversation=${encodeURIComponent(conversationId)}`);
}

export async function enableChatPush(client: ChatSocket, locale: string, userId: string) {
  let token = '';
  let platform: 'android' | 'ios' | 'web';
  if (Capacitor.isNativePlatform()) {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const permission = await FirebaseMessaging.requestPermissions();
    if (permission.receive !== 'granted') throw new Error('permission-denied');
    const result = await FirebaseMessaging.getToken();
    token = result.token;
    platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
    if (platform === 'android') {
      await FirebaseMessaging.createChannel({ id: 'messages', name: 'Messages', importance: 4 });
    }
  } else {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('unsupported');
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.messagingSenderId || !firebaseConfig.appId) throw new Error('not-configured');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('permission-denied');
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) throw new Error('not-configured');
    const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
      import('firebase/app'), import('firebase/messaging'),
    ]);
    if (!await isSupported()) throw new Error('unsupported');
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
    platform = 'web';
  }
  if (!token) throw new Error('token-unavailable');
  await client.request('registerPush', { token, platform, locale });
  localStorage.setItem(`ambatuapp-push-enabled:${userId}`, '1');
}

export async function syncChatPush(client: ChatSocket, locale: string, userId: string) {
  if (localStorage.getItem(`ambatuapp-push-enabled:${userId}`) !== '1') return;
  try {
    let token = '';
    let platform: 'android' | 'ios' | 'web';
    if (Capacitor.isNativePlatform()) {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      if ((await FirebaseMessaging.checkPermissions()).receive !== 'granted') return;
      token = (await FirebaseMessaging.getToken()).token;
      platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
    } else {
      if (Notification.permission !== 'granted' || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return;
      const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
        import('firebase/app'), import('firebase/messaging'),
      ]);
      if (!await isSupported()) return;
      const app = getApps()[0] ?? initializeApp(firebaseConfig);
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      token = await getToken(getMessaging(app), { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
      platform = 'web';
    }
    if (token && client.isOpen) await client.request('registerPush', { token, platform, locale });
  } catch { /* Push is optional; chat should remain usable when sync fails. */ }
}

export function installPushNavigation(getSocket: () => ChatSocket | null, locale: string, userId: string | null, navigate: (url: string) => void) {
  activeLocale = locale;
  activeUserId = userId;
  activeNavigate = navigate;
  if (navigationInstalled) return;
  navigationInstalled = true;
  if (Capacitor.isNativePlatform()) {
    void import('@capacitor-firebase/messaging').then(({ FirebaseMessaging }) => {
      void FirebaseMessaging.addListener('notificationActionPerformed', event => {
        const data = event.notification.data as Record<string, unknown> | undefined;
        goToConversation(String(data?.conversationId ?? ''), activeNavigate);
      });
      void FirebaseMessaging.addListener('tokenReceived', event => {
        const client = getSocket();
        if (activeUserId && localStorage.getItem(`ambatuapp-push-enabled:${activeUserId}`) === '1' && client?.isOpen) {
          void client.request('registerPush', { token: event.token, platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android', locale: activeLocale });
        }
      });
    }).catch(() => undefined);
    return;
  }
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => undefined);
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'chat-notification-click') goToConversation(event.data.conversationId, activeNavigate);
  });
}
