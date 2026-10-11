'use client';
import { useState } from 'react';
import { ScrollSignInCard } from './scroll-signin-card';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';

export function MemberGate({ title, returnTo, children, scrollStyle = false }: { scrollStyle?: boolean; title: string; returnTo: string; children: React.ReactNode }) {
  const { ready, user, configured, signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState(false);
  const header = <header className="ambatuscroll-header"><div className="ambatuscroll-brand-group"><span className="ambatuscroll-brand">ambatu<span className="orange-text">app</span></span><h1>{t(title)}<span className="orange-text">.</span></h1></div></header>;
  if (scrollStyle && (!ready || !user)) return <section className="page scroll-signin-page">{header}{!ready ? <div className="scroll-signin-loading"><LoadingIndicator label={t('common.loading')} /></div> : <ScrollSignInCard title={title} configured={configured} error={error} onSignIn={() => { setError(false); void signInWithGoogle(returnTo).catch(() => setError(true)); }} />}</section>;
  if (!ready) return <div className="page"><LoadingIndicator label={t('common.loading')} /></div>;
  if (!user) return <section className="page"><h1>{t(title)}</h1><p>{t('social.signIn')}</p><button className="button dark" disabled={!configured} onClick={() => { setError(false); void signInWithGoogle(returnTo).catch(() => setError(true)); }}>{t('profile.googleSignIn')}</button>{(!configured || error) && <p role="alert">{t('social.error')}</p>}</section>;
  return <>{children}</>;
}
