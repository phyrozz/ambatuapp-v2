import { Capacitor } from '@capacitor/core';
import type { MouseEvent as ReactMouseEvent } from 'react';

export function isStandalonePwa() {
  return typeof window !== 'undefined' && (
    Capacitor.isNativePlatform() ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function navigateLegalLinkInApp(event: ReactMouseEvent<HTMLAnchorElement>, href: string, navigate: (href: string) => void) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !isStandalonePwa()) return;
  event.preventDefault();
  navigate(href);
}
