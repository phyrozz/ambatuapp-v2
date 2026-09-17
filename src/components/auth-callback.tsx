'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { completeGoogleSignIn } from '@/lib/cognito';
import { useI18n } from './i18n-provider';

export function AuthCallback() {
  const { t } = useI18n();
  const [error, setError] = useState('');
  /* eslint-disable react-hooks/set-state-in-effect -- this component translates the OAuth redirect into UI state. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerError = params.get('error_description') || params.get('error');
    const code = params.get('code');
    if (providerError || !code) { setError(providerError || t('profile.connectionError')); return; }
    void completeGoogleSignIn(code, params.get('state'))
      .then(() => window.location.replace('/profile/'))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t('profile.connectionError')));
  }, [t]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return <section className="page auth-callback"><p className="eyebrow">AMBATUAPP</p><h1>{error ? t('profile.connectionError') : t('profile.wait')}</h1>{error ? <><p>{error}</p><Link className="button dark" href="/profile/">{t('profile.signIn')}</Link></> : <p>{t('profile.googlePrompt')}</p>}</section>;
}
