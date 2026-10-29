'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, LockKeyhole } from 'lucide-react';
import { completeGoogleSignIn, SignInSessionExpiredError } from '@/lib/cognito';
import { initializePlayerProfile } from '@/lib/player-profile';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';
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
    if (providerError || !code) { setError(t('profile.connectionError')); return; }
    void completeGoogleSignIn(code, state)
      .then(async ({ tokens, returnTo }) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try { await initializePlayerProfile(tokens.idToken, controller.signal); }
        catch { /* The session stays valid and registration retries after redirect. */ }
        finally { clearTimeout(timeout); }
        window.location.replace(returnTo);
      })
      .catch((cause: unknown) => setError(t(cause instanceof SignInSessionExpiredError ? 'profile.sessionExpired' : 'profile.connectionError')));
  }, [t]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return (
    <section className="page auth-callback">
      <div className="auth-callback-card" aria-live="polite">
        <div className={`auth-callback-icon${error ? ' is-error' : ''}`} aria-hidden="true">
          {error ? <AlertCircle size={34} /> : <LockKeyhole size={34} />}
        </div>
        <p className="eyebrow">AMBATUAPP</p>
        {error ? (
          <>
            <h1>{error}</h1>
            <Link className="button dark auth-callback-action" href="/profile/">
              {t('profile.signIn')}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <>
            <h1>{t('profile.wait')}</h1>
            <LoadingIndicator label={t('profile.signingIn')} />
          </>
        )}
      </div>
    </section>
  );
}
