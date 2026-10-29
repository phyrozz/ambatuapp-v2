'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

const INTERSTITIAL_SCRIPT_URL = 'https://a.pemsrv.com/ad-provider.js';

export function AdInterstitial() {
  const initialized = useRef(false);
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    if (native || initialized.current) return;
    initialized.current = true;

    if (!document.getElementById('exoclick-ad-provider')) {
      const script = document.createElement('script');
      script.id = 'exoclick-ad-provider';
      script.async = true;
      script.type = 'application/javascript';
      script.src = INTERSTITIAL_SCRIPT_URL;
      document.head.appendChild(script);
    }
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
  }, [native]);

  if (native) return null;

  return <ins className="eas6a97888e35" data-zoneid="6069942" />;
}
