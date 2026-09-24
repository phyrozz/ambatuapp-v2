'use client';
import { LogIn, LogOut, Save, Share2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from './app-provider';
import { useAuth } from './auth-provider';
import { games } from '@/lib/catalog';
import { useI18n } from './i18n-provider';
import { initializePlayerProfile, PlayerProfileError, savePlayerProfile } from '@/lib/player-profile';
import { ChatShareDialog, publicChatUrl } from './chat-share-dialog';

function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export function ProfilePanel() {
  const { t } = useI18n();
  const { favorites, scores, plays } = useApp();
  const { configured, ready, signInWithGoogle, signOut, setDisplayName, user, getIdToken } = useAuth();
  const signedIn = Boolean(user);
  const [username, setUsername] = useState(''), [birthDate, setBirthDate] = useState(''), [saving, setSaving] = useState(false), [profileError, setProfileError] = useState(''), [profileStatus, setProfileStatus] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  useEffect(() => {
    if (!user) return;
    void getIdToken().then((token) => token ? initializePlayerProfile(token) : null).then((profile) => {
      if (!profile) return;
      setUsername(profile.username); setBirthDate(profile.birthDate ?? '');
    }).catch(() => setProfileError(t('profile.editLoadError')));
  }, [getIdToken, t, user]);
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSaving(true); setProfileError(''); setProfileStatus('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error(t('profile.connectionError'));
      const profile = await savePlayerProfile(token, { username, birthDate: birthDate || null });
      setUsername(profile.username); setDisplayName(profile.username); setBirthDate(profile.birthDate ?? ''); setProfileStatus(t('profile.savedProfile'));
    } catch (error) { setProfileError(error instanceof PlayerProfileError && error.code === 'username_taken' ? t('profile.usernameTaken') : error instanceof Error ? error.message : t('profile.connectionError')); }
    finally { setSaving(false); }
  }
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
      <section className="panel profile-account-panel">
        <h2>{signedIn ? t('profile.signedIn') : t('profile.home')}</h2>
        {!configured ? (
          <><p>{t('profile.guest')}</p><div className="note-panel">{t('profile.notConnected')}</div></>
        ) : signedIn ? (
          <>
            <p>{t('profile.signedInAs', { email: user?.email ?? '' })}</p>
            <p>{t('profile.leaderboardReady')}</p>
            <p>{t('profile.localSave')}</p>
            <form className="account-form player-profile-form" onSubmit={saveProfile}>
              <h3>{t('profile.editTitle')}</h3>
              <p>{t('profile.editHint')}</p>
              <label>{t('profile.username')}<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={24} required autoComplete="nickname" /></label>
              <label>{t('profile.birthDate')}<input type="date" value={birthDate} max={today()} onChange={(event) => setBirthDate(event.target.value)} /></label>
              {profileError && <p className="form-error" role="alert">{profileError}</p>}
              {profileStatus && <p className="form-success" role="status">{profileStatus}</p>}
              <div className="profile-action-bar">
                <button className="button profile-save-button" type="submit" disabled={saving}><Save size={17}/>{saving ? t('profile.savingProfile') : t('profile.saveProfile')}</button>
                <div className="profile-secondary-actions">
                  <button type="button" className="button profile-share-button" onClick={() => { if (user) setShareUrl(publicChatUrl({ user: user.id, name: user.name })); }}><Share2 size={17}/>{t('profile.shareProfile')}</button>
                  <button type="button" className="button profile-signout-button" onClick={signOut}><LogOut size={17}/>{t('profile.signOut')}</button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <>
            <p>{t('profile.googlePrompt')}</p>
            <button className="button dark" disabled={!ready} onClick={() => void signInWithGoogle()}><LogIn size={17} />{t('profile.googleSignIn')}</button>
          </>
        )}
      </section>
      {shareUrl && <ChatShareDialog url={shareUrl} onClose={() => setShareUrl('')}/>}
    </div>
  );
}
