import { Capacitor } from '@capacitor/core';
export async function haptic() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* Device may not support haptics. */
  }
}
export async function openExternal(url: string) {
  if (!/^https:\/\//i.test(url)) return;
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else window.open(url, '_blank', 'noopener,noreferrer');
}
