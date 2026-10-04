'use client';
import { Suspense, useState } from 'react';
import { LogIn, Play } from 'lucide-react';
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
    <div className="scroll-signin-card">
      <div className="scroll-signin-art" aria-hidden="true">
        <span className="scroll-signin-orbit scroll-signin-orbit-one" />
        <span className="scroll-signin-orbit scroll-signin-orbit-two" />
        <div className="scroll-signin-phone"><span className="scroll-signin-phone-speaker" /><span className="scroll-signin-play"><Play size={26} fill="currentColor" /></span><span className="scroll-signin-phone-progress" /></div>
        <span className="scroll-signin-spark scroll-signin-spark-one" />
        <span className="scroll-signin-spark scroll-signin-spark-two" />
      </div>
      <div className="scroll-signin-copy">
        <span className="scroll-signin-kicker">{t('nav.scroll')}</span>
        <h2>{t('social.signIn')}</h2>
        <button className="button dark scroll-signin-button" disabled={!configured} onClick={() => { const params = new URLSearchParams(window.location.search); const clip = params.get('clip'); const conversation = params.get('conversation'); const creator = params.get('creator'); const returnTo = clip ? `/scroll/?${new URLSearchParams({ clip, ...(conversation ? { conversation } : {}), ...(creator && /^[\w-]{1,128}$/.test(creator) ? { creator } : {}) }).toString()}` : '/scroll/'; setSignInError(false); void signInWithGoogle(returnTo).catch(() => setSignInError(true)); }}><LogIn size={18} />{t('profile.googleSignIn')}</button>
        {(!configured || signInError) && <p className="scroll-signin-error" role="alert">{t('social.error')}</p>}
      </div>
    </div>
  </section>;

  return <Suspense fallback={<section className="ambatuscroll"><AmbatuscrollHeader /><div className="scroll-single-status"><LoadingIndicator label={t('common.loading')} /></div></section>}><Ambatuscroll key={user.id} /></Suspense>;
}
