'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT_ID;
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
    if (native || disabled || !ADSENSE_CLIENT || !ADSENSE_SLOT) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.warn('Web banner could not be requested.', error);
    }
  }, [disabled, native]);

  if (disabled) return null;

  if (native) {
    return privacyOptionsRequired ? (
      <button className="ad-privacy-button" type="button" onClick={() => void AdMob.showPrivacyOptionsForm()}>
        Ad privacy choices
      </button>
    ) : null;
  }

  if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return null;

  return (
    <aside className="web-ad" aria-label="Advertisement">
      <span>Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
