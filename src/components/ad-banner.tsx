'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

declare global {
  interface Window {
    AdProvider?: Record<string, unknown>[];
  }
}

const EXOCLICK_ZONE_ID = process.env.NEXT_PUBLIC_EXOCLICK_ZONE_ID;
const EXOCLICK_SCRIPT_URL = process.env.NEXT_PUBLIC_EXOCLICK_SCRIPT_URL;
export function AdBanner({ disabled = false }: { disabled?: boolean }) {
  const native = Capacitor.isNativePlatform();
  const exoClickRequested = useRef(false);

  useEffect(() => {
    if (native) void AdMob.removeBanner().catch(() => undefined);
  }, [native]);

  useEffect(() => {
    if (native || disabled || !EXOCLICK_ZONE_ID || !EXOCLICK_SCRIPT_URL || exoClickRequested.current) return;
    exoClickRequested.current = true;
    if (!document.getElementById('exoclick-ad-provider')) {
      const script = document.createElement('script');
      script.id = 'exoclick-ad-provider';
      script.async = true;
      script.type = 'application/javascript';
      script.src = EXOCLICK_SCRIPT_URL;
      document.head.appendChild(script);
    }
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  }, [disabled, native]);

  if (disabled) return null;

  if (native) return null;

  if (!EXOCLICK_ZONE_ID || !EXOCLICK_SCRIPT_URL) return null;

  return (
    <aside className="web-ad" aria-label="Advertisement">
      <span>Advertisement</span>
      <ins className="adsbyexoclick" data-zoneid={EXOCLICK_ZONE_ID} />
    </aside>
  );
}
