'use client';

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob';

declare global {
  interface Window {
    AdProvider?: Record<string, unknown>[];
  }
}

const EXOCLICK_ZONE_ID = process.env.NEXT_PUBLIC_EXOCLICK_ZONE_ID;
const EXOCLICK_SCRIPT_URL = process.env.NEXT_PUBLIC_EXOCLICK_SCRIPT_URL;
const ANDROID_TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111';
const IOS_TEST_BANNER = 'ca-app-pub-3940256099942544/2934735716';

let nativeInitialization: Promise<boolean> | undefined;

async function initializeNativeAds(): Promise<boolean> {
  nativeInitialization ??= (async () => {
    await AdMob.initialize();
    let consent = await AdMob.requestConsentInfo();
    if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
      consent = await AdMob.showConsentForm();
    }
    return consent.canRequestAds;
  })().catch((error) => {
    console.warn('Native ads could not be initialized.', error);
    return false;
  });
  return nativeInitialization;
}

function getNativeBannerId(): string {
  if (Capacitor.getPlatform() === 'ios') {
    return process.env.NEXT_PUBLIC_ADMOB_IOS_BANNER_ID || IOS_TEST_BANNER;
  }
  return process.env.NEXT_PUBLIC_ADMOB_ANDROID_BANNER_ID || ANDROID_TEST_BANNER;
}

function isUsingNativeTestBanner(): boolean {
  return Capacitor.getPlatform() === 'ios'
    ? !process.env.NEXT_PUBLIC_ADMOB_IOS_BANNER_ID
    : !process.env.NEXT_PUBLIC_ADMOB_ANDROID_BANNER_ID;
}

export function AdBanner({ disabled = false }: { disabled?: boolean }) {
  const native = Capacitor.isNativePlatform();
  const exoClickRequested = useRef(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);

  useEffect(() => {
    if (!native || disabled) {
      if (native) void AdMob.removeBanner().catch(() => undefined);
      return;
    }

    let active = true;
    void (async () => {
      const canRequestAds = await initializeNativeAds();
      if (!active || !canRequestAds) return;
      const consent = await AdMob.requestConsentInfo();
      setPrivacyOptionsRequired(
        String(consent.privacyOptionsRequirementStatus) === 'REQUIRED',
      );
      await AdMob.showBanner({
        adId: getNativeBannerId(),
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        // Leaves a clear gap above the app's bottom navigation.
        margin: 96,
        isTesting: isUsingNativeTestBanner(),
      });
    })().catch((error) => console.warn('Native banner could not be shown.', error));

    return () => {
      active = false;
      void AdMob.removeBanner().catch(() => undefined);
    };
  }, [disabled, native]);

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

  if (native) {
    return privacyOptionsRequired ? (
      <button className="ad-privacy-button" type="button" onClick={() => void AdMob.showPrivacyOptionsForm()}>
        Ad privacy choices
      </button>
    ) : null;
  }

  if (!EXOCLICK_ZONE_ID || !EXOCLICK_SCRIPT_URL) return null;

  return (
    <aside className="web-ad" aria-label="Advertisement">
      <span>Advertisement</span>
      <ins className="adsbyexoclick" data-zoneid={EXOCLICK_ZONE_ID} />
    </aside>
  );
}
