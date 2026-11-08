import { Capacitor } from '@capacitor/core';

/** Share links must point to the public site when running inside the native app. */
export function publicAppUrl(path: string, query: Record<string, string> = {}) {
  const origin =
    process.env.NEXT_PUBLIC_SHARE_BASE_URL ||
    (Capacitor.isNativePlatform() ? 'https://www.ambatu.fun' : window.location.origin);
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

export const friendLink = (id: string) => publicAppUrl('/friends/', { user: id });

/** Recognize only our own Dream links; never fetch chat preview content. */
export function dreamIdFromShareUrl(raw: string, currentOrigin: string) {
  try {
    const url = new URL(raw.startsWith('www.') ? `https://${raw}` : raw);
    const current = new URL(currentOrigin);
    const origins = new Set(['https://www.ambatu.fun', 'https://ambatu.fun', current.origin]);
    if (process.env.NEXT_PUBLIC_SHARE_BASE_URL)
      origins.add(new URL(process.env.NEXT_PUBLIC_SHARE_BASE_URL).origin);
    const local = ['localhost', '127.0.0.1', '[::1]'];
    const localLink = local.includes(url.hostname) && local.includes(current.hostname);
    const id = url.searchParams.get('dream');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (!origins.has(url.origin) && !localLink) ||
      !/^\/ambatupost\/?$/.test(url.pathname) ||
      url.searchParams.getAll('dream').length !== 1 ||
      !id ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)
    )
      return null;
    return id;
  } catch {
    return null;
  }
}
