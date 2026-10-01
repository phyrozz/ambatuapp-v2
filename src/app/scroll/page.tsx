'use client';
import { useState } from 'react';
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
        <button className="button dark scroll-signin-button" disabled={!configured} onClick={() => { setSignInError(false); void signInWithGoogle('/scroll/').catch(() => setSignInError(true)); }}><LogIn size={18} />{t('profile.googleSignIn')}</button>
        {(!configured || signInError) && <p className="scroll-signin-error" role="alert">{t('social.error')}</p>}
      </div>
    </div>
  </section>;

  return <Ambatuscroll key={user.id} />;
}
