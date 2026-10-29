'use client';
import { LogIn, Play } from 'lucide-react';
import { useI18n } from './i18n-provider';

export function ScrollSignInCard({ title, configured, error, onSignIn }: { title?: string; configured: boolean; error: boolean; onSignIn: () => void }) {
  const { t } = useI18n();
  return (
    <div className="scroll-signin-card">
      <div className="scroll-signin-art" aria-hidden="true">
        <span className="scroll-signin-orbit scroll-signin-orbit-one" />
        <span className="scroll-signin-orbit scroll-signin-orbit-two" />
        <div className="scroll-signin-phone"><span className="scroll-signin-phone-speaker" /><span className="scroll-signin-play"><Play size={26} fill="currentColor" /></span><span className="scroll-signin-phone-progress" /></div>
        <span className="scroll-signin-spark scroll-signin-spark-one" />
        <span className="scroll-signin-spark scroll-signin-spark-two" />
      </div>
      <div className="scroll-signin-copy">
        {title && <span className="scroll-signin-kicker">{t(title)}</span>}
        <h2>{t('social.signIn')}</h2>
        <button className="button dark scroll-signin-button" disabled={!configured} onClick={onSignIn}><LogIn size={18} />{t('profile.googleSignIn')}</button>
        {(!configured || error) && <p className="scroll-signin-error" role="alert">{t('social.error')}</p>}
      </div>
    </div>
  );
}
