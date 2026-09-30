'use client';
import { useState } from 'react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';

export function MemberGate({ title, returnTo, children }: { title: string; returnTo: string; children: React.ReactNode }) {
  const { ready, user, configured, signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState(false);
  if (!ready) return <div className="page"><LoadingIndicator label={t('common.loading')} /></div>;
  if (!user) return <section className="page"><h1>{t(title)}</h1><p>{t('social.signIn')}</p><button className="button dark" disabled={!configured} onClick={() => { setError(false); void signInWithGoogle(returnTo).catch(() => setError(true)); }}>{t('profile.googleSignIn')}</button>{(!configured || error) && <p role="alert">{t('social.error')}</p>}</section>;
  return <>{children}</>;
}
