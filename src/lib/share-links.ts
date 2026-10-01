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
