'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { completeGoogleSignIn } from '@/lib/cognito';
import { initializePlayerProfile } from '@/lib/player-profile';
import { useI18n } from './i18n-provider';
import { Capacitor } from '@capacitor/core';

export function AuthCallback() {
  const { t } = useI18n();
  const [error, setError] = useState('');
  /* eslint-disable react-hooks/set-state-in-effect -- this component translates the OAuth redirect into UI state. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerError = params.get('error_description') || params.get('error');
    const code = params.get('code');
    const state = params.get('state');
    if (!Capacitor.isNativePlatform() && state?.startsWith('native.')) {
      window.location.replace(`com.example.ambatuapp://auth/callback?${params.toString()}`);
      return;
    }
    if (providerError || !code) { setError(providerError || t('profile.connectionError')); return; }
    void completeGoogleSignIn(code, state)
      .then(async ({ tokens, returnTo }) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try { await initializePlayerProfile(tokens.idToken, controller.signal); }
        catch { /* The session stays valid and registration retries after redirect. */ }
        finally { clearTimeout(timeout); }
        window.location.replace(returnTo);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t('profile.connectionError')));
  }, [t]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return <section className="page auth-callback"><p className="eyebrow">AMBATUAPP</p><h1>{error ? t('profile.connectionError') : t('profile.wait')}</h1>{error ? <><p>{error}</p><Link className="button dark" href="/profile/">{t('profile.signIn')}</Link></> : <p>{t('profile.googlePrompt')}</p>}</section>;
}
