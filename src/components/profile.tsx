'use client';
import { LogIn, LogOut } from 'lucide-react';
import { useApp } from './app-provider';
import { useAuth } from './auth-provider';
import { games } from '@/lib/catalog';
import { useI18n } from './i18n-provider';

export function ProfilePanel() {
  const { t } = useI18n();
  const { favorites, scores, plays } = useApp();
  const { configured, ready, signInWithGoogle, signOut, user } = useAuth();
  const signedIn = Boolean(user);
  return (
    <div className="account-grid">
      <section className="panel">
        <h2>{t('profile.corner')}</h2>
        <p>{t('profile.saved')}</p>
        <div className="stats-grid">
          <div className="stat"><b>{favorites.length}</b><span>{t('profile.favoriteSounds')}</span></div>
          <div className="stat"><b>{plays}</b><span>{t('profile.soundsPlayed')}</span></div>
        </div>
        <p className="eyebrow">{t('profile.personalBests')}</p>
        {games.map((game) => <div className="score-row" key={game.id}><span>{game.name}</span><b>{scores[game.id] || 0}</b></div>)}
      </section>
      <section className="panel">
        <h2>{signedIn ? t('profile.signedIn') : t('profile.home')}</h2>
        {!configured ? (
          <><p>{t('profile.guest')}</p><div className="note-panel">{t('profile.notConnected')}</div></>
        ) : signedIn ? (
          <>
            <p>{t('profile.signedInAs', { email: user?.email ?? '' })}</p>
            <p>{t('profile.leaderboardReady')}</p>
            <p>{t('profile.localSave')}</p>
            <button className="button secondary" onClick={signOut}><LogOut size={17} />{t('profile.signOut')}</button>
          </>
        ) : (
          <>
            <p>{t('profile.googlePrompt')}</p>
            <button className="button dark" disabled={!ready} onClick={() => void signInWithGoogle()}><LogIn size={17} />{t('profile.googleSignIn')}</button>
          </>
        )}
      </section>
    </div>
  );
}
