'use client';
import { Suspense, useState } from 'react';
import { ScrollSignInCard } from '@/components/scroll-signin-card';
import { Ambatuscroll, AmbatuscrollHeader } from '@/components/ambatuscroll';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/components/i18n-provider';
import { LoadingIndicator } from '@/components/loading-indicator';

export default function ScrollPage() {
  const { ready, user, configured, signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const [signInError, setSignInError] = useState(false);

  if (!ready) return <section className="page scroll-signin-page"><AmbatuscrollHeader /><div className="scroll-signin-loading"><LoadingIndicator label={t('common.loading')} /></div></section>;
  if (!user) return <section className="page scroll-signin-page">
    <AmbatuscrollHeader />
    <ScrollSignInCard configured={configured} error={signInError} onSignIn={() => { const params = new URLSearchParams(window.location.search); const clip = params.get('clip'); const conversation = params.get('conversation'); const creator = params.get('creator'); const returnTo = clip ? `/scroll/?${new URLSearchParams({ clip, ...(conversation ? { conversation } : {}), ...(creator && /^[\w-]{1,128}$/.test(creator) ? { creator } : {}) }).toString()}` : '/scroll/'; setSignInError(false); void signInWithGoogle(returnTo).catch(() => setSignInError(true)); }} />
  </section>;

  return <Suspense fallback={<section className="ambatuscroll"><AmbatuscrollHeader /><div className="scroll-single-status"><LoadingIndicator label={t('common.loading')} /></div></section>}><Ambatuscroll key={user.id} /></Suspense>;
}
