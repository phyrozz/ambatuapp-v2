'use client';

import { Camera, LogIn, LogOut, Save, Share2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useApp } from './app-provider';
import { useAuth } from './auth-provider';
import { games } from '@/lib/catalog';
import { useI18n } from './i18n-provider';
import { getProfileAvatars, initializePlayerProfile, PlayerProfileError, saveProfileAvatar, savePlayerProfile, submitCustomProfileAvatar, type ProfileAvatar } from '@/lib/player-profile';
import { ChatShareDialog } from './chat-share-dialog';
import { AvatarCropDialog } from './avatar-crop-dialog';
import { LoadingIndicator } from './loading-indicator';
import { CreatorProfile } from './creator-profile';
import { publicAppUrl } from '@/lib/share-links';

function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function preloadAvatarImage(src: string): Promise<void> {
  const image = new window.Image();
  if (typeof image.decode === 'function') {
    image.src = src;
    return image.decode();
  }
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Avatar image failed to load.'));
    image.src = src;
    if (image.complete) {
      if (image.naturalWidth > 0) resolve();
      else reject(new Error('Avatar image failed to load.'));
    }
  });
}

export function ProfilePanel() {
  const { t } = useI18n();
  const { favorites, scores, plays } = useApp();
  const { configured, ready, signInWithGoogle, signOut, setDisplayName, user, getIdToken } = useAuth();
  const signedIn = Boolean(user);
  const userId = user?.id;
  const [username, setUsername] = useState(''), [birthDate, setBirthDate] = useState(''), [saving, setSaving] = useState(false), [profileError, setProfileError] = useState(''), [profileStatus, setProfileStatus] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null), [avatarId, setAvatarId] = useState<string | null>(null), [avatarRemoved, setAvatarRemoved] = useState(false);
  const [avatars, setAvatars] = useState<ProfileAvatar[]>([]), [avatarSaving, setAvatarSaving] = useState(false), [avatarError, setAvatarError] = useState(''), [avatarStatus, setAvatarStatus] = useState('');
  const [profileLoadState, setProfileLoadState] = useState<{ userId: string; status: 'loading' | 'ready' | 'error' } | null>(null);
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [bio, setBio] = useState('');
  const profileLoadStatus = user && profileLoadState?.userId === user.id ? profileLoadState.status : 'loading';
  const profileLoading = !ready || (configured && signedIn && profileLoadStatus === 'loading');
  const profileLoadFailed = configured && signedIn && profileLoadStatus === 'error';

  useEffect(() => {
    if (!ready || !configured || !userId) return;
    let active = true;
    void (async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error('No session');
        const [profile, presetAvatars] = await Promise.all([initializePlayerProfile(token), getProfileAvatars(token)]);
        const imageUrls = [...new Set([
          ...(profile.avatarUrl ? [profile.avatarUrl] : []),
          ...presetAvatars.flatMap((avatar) => avatar.imageUrl ? [avatar.imageUrl] : []),
        ])];
        await Promise.all(imageUrls.map(preloadAvatarImage));
        if (!active) return;
        setUsername(profile.username); setBirthDate(profile.birthDate ?? ''); setBio(profile.bio ?? '');
        setAvatarUrl(profile.avatarUrl ?? null); setAvatarId(profile.avatarId ?? null); setAvatarRemoved(Boolean(profile.avatarRemoved));
        setAvatars(presetAvatars);
        setProfileLoadState({ userId, status: 'ready' });
      } catch {
        if (active) setProfileLoadState({ userId, status: 'error' });
      }
    })();
    return () => { active = false; };
  }, [configured, getIdToken, profileLoadAttempt, ready, userId]);

  function retryProfileLoad() {
    if (!user) return;
    setProfileLoadState({ userId: user.id, status: 'loading' });
    setProfileLoadAttempt((attempt) => attempt + 1);
  }

  async function leaveProfile() {
    setProfileLoadState(null);
    await signOut();
  }

  async function chooseAvatar(nextAvatarId: string | null) {
    setAvatarSaving(true); setAvatarError(''); setAvatarStatus('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('No session');
      await saveProfileAvatar(token, nextAvatarId);
      const selected = avatars.find((avatar) => avatar.id === nextAvatarId);
      setAvatarId(nextAvatarId); setAvatarUrl(selected?.imageUrl ?? null); setAvatarRemoved(false);
      setAvatarStatus(t('profile.avatarSaved'));
      window.dispatchEvent(new Event('ambatu:profile-changed'));
    } catch { setAvatarError(t('profile.avatarSaveError')); }
    finally { setAvatarSaving(false); }
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size >= 3 * 1024 * 1024) { setAvatarError(t('profile.avatarFileTooLarge')); return; }
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') { setAvatarError(t('profile.avatarFileType')); return; }
    setAvatarError(''); setAvatarStatus(''); setCropFile(file);
  }

  async function submitCroppedAvatar(image: Blob) {
    setAvatarSaving(true); setAvatarError(''); setAvatarStatus('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('No session');
      const uploadedAvatarUrl = await submitCustomProfileAvatar(token, image);
      if (uploadedAvatarUrl) await preloadAvatarImage(uploadedAvatarUrl);
      setAvatarUrl(uploadedAvatarUrl); setAvatarId(null); setAvatarRemoved(false); setCropFile(null); setAvatarStatus(t('profile.avatarUploaded'));
      window.dispatchEvent(new Event('ambatu:profile-changed'));
    } catch { setAvatarError(t('profile.avatarSaveError')); }
    finally { setAvatarSaving(false); }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSaving(true); setProfileError(''); setProfileStatus('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error(t('profile.connectionError'));
      const profile = await savePlayerProfile(token, { username, birthDate: birthDate || null, bio });
      setUsername(profile.username); setDisplayName(profile.username); setBirthDate(profile.birthDate ?? ''); setProfileStatus(t('profile.savedProfile'));
      setBio(profile.bio ?? bio);
      window.dispatchEvent(new Event('ambatu:profile-changed'));
    } catch (error) { setProfileError(error instanceof PlayerProfileError && error.code === 'username_taken' ? t('profile.usernameTaken') : t('profile.connectionError')); }
    finally { setSaving(false); }
  }

  if (profileLoading) return <div className="module-loading profile-loading" aria-busy="true"><LoadingIndicator label={t('profile.loading')} /></div>;
  if (profileLoadFailed) return <div className="module-loading profile-load-error" role="alert"><p>{t('profile.editLoadError')}</p><button className="button secondary compact" type="button" onClick={retryProfileLoad}>{t('common.retry')}</button></div>;

  return (
    <>
    {user && <CreatorProfile key={user.id} id={user.id} embedded/>}
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
      <section className="panel profile-account-panel" id="my-profile-editor">
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
              <section className="profile-avatar-editor" aria-labelledby="profile-avatar-heading">
                <div className="profile-avatar-editor-heading">
                  <div><h4 id="profile-avatar-heading">{t('profile.avatarHeading')}</h4><p>{t('profile.avatarHint')}</p></div>
                  <div className="profile-avatar-current">{avatarUrl ? <img src={avatarUrl} alt={t('profile.currentAvatar')} /> : <span>{username.slice(0, 1).toLocaleUpperCase() || '?'}</span>}</div>
                </div>
                <p className="profile-avatar-notice">{t('profile.avatarNotice')}</p>
                <p className="profile-avatar-section-label">{t('profile.avatarPresets')}</p>
                <div className="profile-avatar-presets">
                  <button type="button" className={`profile-avatar-preset${!avatarId && !avatarUrl ? ' selected' : ''}`} aria-label={t('profile.avatarDefault')} aria-pressed={!avatarId && !avatarUrl} disabled={avatarSaving} onClick={() => void chooseAvatar(null)}><span>{username.slice(0, 1).toLocaleUpperCase() || '?'}</span><small>{t('profile.avatarDefault')}</small></button>
                  {avatars.map((avatar) => <button type="button" key={avatar.id} className={`profile-avatar-preset${avatarId === avatar.id ? ' selected' : ''}`} aria-label={t('profile.chooseAvatar', { name: avatar.name })} aria-pressed={avatarId === avatar.id} disabled={avatarSaving} onClick={() => void chooseAvatar(avatar.id)}>{avatar.imageUrl ? <img src={avatar.imageUrl} alt="" /> : <span>✦</span>}<small>{avatar.name}</small></button>)}
                  {!avatars.length && <p className="profile-avatar-empty">{t('profile.avatarNoPresets')}</p>}
                </div>
                <label className="profile-avatar-upload"><input ref={fileInput} type="file" accept="image/png,image/jpeg" onChange={selectImage} disabled={avatarSaving} /><Camera size={17}/><span>{t('profile.avatarCustomUpload')}</span></label>
                <p className="profile-avatar-file-hint">{t('profile.avatarFileHint')}</p>
                {avatarRemoved && <p className="profile-avatar-removed" role="status">{t('profile.avatarRemoved')}</p>}
                {avatarError && <p className="form-error" role="alert">{avatarError}</p>}
                {avatarStatus && <p className="form-success" role="status">{avatarStatus}</p>}
              </section>
              <label>{t('profile.username')}<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={24} required autoComplete="nickname" /></label>
              <label>{t('creator.bio')}<textarea className="creator-bio-input" value={bio} maxLength={280} onChange={event => setBio(event.target.value)} placeholder={t('creator.bioHint')}/></label>
              <label>{t('profile.birthDate')}<input type="date" value={birthDate} max={today()} onChange={(event) => setBirthDate(event.target.value)} /></label>
              {profileError && <p className="form-error" role="alert">{profileError}</p>}
              {profileStatus && <p className="form-success" role="status">{profileStatus}</p>}
              <div className="profile-action-bar">
                <button className="button profile-save-button" type="submit" disabled={saving}><Save size={17}/>{saving ? t('profile.savingProfile') : t('profile.saveProfile')}</button>
                <div className="profile-secondary-actions">
                  <button type="button" className="button profile-share-button" onClick={() => { if (user) setShareUrl(publicAppUrl('/scroll/profile/', { user:user.id })); }}><Share2 size={17}/>{t('profile.shareProfile')}</button>
                  <button type="button" className="button profile-signout-button" onClick={leaveProfile}><LogOut size={17}/>{t('profile.signOut')}</button>
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
      {shareUrl && <ChatShareDialog url={shareUrl} creator onClose={() => setShareUrl('')}/>}
      {cropFile && <AvatarCropDialog file={cropFile} title={t('profile.avatarCropTitle')} help={t('profile.avatarCropHelp')} zoomLabel={t('profile.avatarZoom')} cancelLabel={t('profile.avatarCancel')} useImageLabel={avatarSaving ? t('profile.avatarSaving') : t('profile.avatarUseImage')} busy={avatarSaving} onCancel={() => setCropFile(null)} onComplete={(image) => void submitCroppedAvatar(image)} />}
    </div>
    </>
  );
}
