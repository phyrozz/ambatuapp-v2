'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Camera,
  Film,
  Heart,
  LogIn,
  LogOut,
  Music2,
  Pencil,
  Save,
  Share2,
  Trophy,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useApp } from './app-provider';
import { useAuth } from './auth-provider';
import { games } from '@/lib/catalog';
import { useI18n } from './i18n-provider';
import {
  getProfileAvatars,
  initializePlayerProfile,
  PlayerProfileError,
  saveProfileAvatar,
  savePlayerProfile,
  submitCustomProfileAvatar,
  type ProfileAvatar,
} from '@/lib/player-profile';
import { ChatShareDialog } from './chat-share-dialog';
import { AvatarCropDialog } from './avatar-crop-dialog';
import { LoadingIndicator } from './loading-indicator';
import { CreatorClips } from './creator-clips';
import { useCreatorProfile } from './use-creator-profile';
import { VideoUploadDialog } from './video-upload-dialog';
import { creatorHref } from '@/lib/creator-profile';
import { publicAppUrl } from '@/lib/share-links';
import { MyContributions } from './my-contributions';
import './my-dreamy.css';

type ProfileTab = 'videos' | 'lores' | 'sounds' | 'profile' | 'activity';
const profileTabs = [
  { id: 'videos', label: 'profile.tabVideos', icon: Film },
  { id: 'lores', label: 'profile.tabLore', icon: BookOpen },
  { id: 'sounds', label: 'profile.tabSoundboard', icon: Music2 },
  { id: 'profile', label: 'profile.tabEdit', icon: Pencil },
  { id: 'activity', label: 'profile.tabActivity', icon: BarChart3 },
] as const;

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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
  const { t, locale } = useI18n();
  const { favorites, scores, plays } = useApp();
  const { configured, ready, signInWithGoogle, signOut, setDisplayName, user, getIdToken } =
    useAuth();
  const signedIn = Boolean(user);
  const userId = user?.id;
  const [activeTab, setActiveTab] = useState<ProfileTab>('videos');
  const tabButtons = useRef<Partial<Record<ProfileTab, HTMLButtonElement | null>>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [savedIdentity, setSavedIdentity] = useState({ username: '', bio: '' });
  const [failedAvatar, setFailedAvatar] = useState('');
  const [username, setUsername] = useState(''),
    [birthDate, setBirthDate] = useState(''),
    [saving, setSaving] = useState(false),
    [profileError, setProfileError] = useState(''),
    [profileStatus, setProfileStatus] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null),
    [avatarId, setAvatarId] = useState<string | null>(null),
    [avatarRemoved, setAvatarRemoved] = useState(false);
  const [avatars, setAvatars] = useState<ProfileAvatar[]>([]),
    [avatarSaving, setAvatarSaving] = useState(false),
    [avatarError, setAvatarError] = useState(''),
    [avatarStatus, setAvatarStatus] = useState('');
  const [profileLoadState, setProfileLoadState] = useState<{
    userId: string;
    status: 'loading' | 'ready' | 'error';
  } | null>(null);
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [bio, setBio] = useState('');
  const profileLoadStatus =
    user && profileLoadState?.userId === user.id ? profileLoadState.status : 'loading';
  const profileLoading = !ready || (configured && signedIn && profileLoadStatus === 'loading');
  const profileLoadFailed = configured && signedIn && profileLoadStatus === 'error';
  const creator = useCreatorProfile(profileLoadStatus === 'ready' ? (userId ?? '') : '');

  useEffect(() => {
    const syncTab = () => {
      if (window.location.hash === '#my-profile-editor') setActiveTab('profile');
      else if (window.location.hash === '#my-activity') setActiveTab('activity');
      else if (window.location.hash === '#my-lores') setActiveTab('lores');
      else if (window.location.hash === '#my-sounds') setActiveTab('sounds');
      else if (window.location.hash === '#my-videos') setActiveTab('videos');
    };
    syncTab();
    window.addEventListener('hashchange', syncTab);
    return () => window.removeEventListener('hashchange', syncTab);
  }, []);

  function selectTab(tab: ProfileTab) {
    setActiveTab(tab);
    const hash = {
      videos: 'my-videos',
      lores: 'my-lores',
      sounds: 'my-sounds',
      profile: 'my-profile-editor',
      activity: 'my-activity',
    }[tab];
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}#${hash}`,
    );
  }

  useEffect(() => {
    if (!ready || !configured || !userId) return;
    let active = true;
    void (async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error('No session');
        const [profile, presetAvatars] = await Promise.all([
          initializePlayerProfile(token),
          getProfileAvatars(token),
        ]);
        if (!active) return;
        setUsername(profile.username);
        setBirthDate(profile.birthDate ?? '');
        setBio(profile.bio ?? '');
        setSavedIdentity({ username: profile.username, bio: profile.bio ?? '' });
        setAvatarUrl(profile.avatarUrl ?? null);
        setAvatarId(profile.avatarId ?? null);
        setAvatarRemoved(Boolean(profile.avatarRemoved));
        setAvatars(presetAvatars);
        setProfileLoadState({ userId, status: 'ready' });
      } catch {
        if (active) setProfileLoadState({ userId, status: 'error' });
      }
    })();
    return () => {
      active = false;
    };
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
    setAvatarSaving(true);
    setAvatarError('');
    setAvatarStatus('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('No session');
      await saveProfileAvatar(token, nextAvatarId);
      const selected = avatars.find((avatar) => avatar.id === nextAvatarId);
      setAvatarId(nextAvatarId);
      setAvatarUrl(selected?.imageUrl ?? null);
      setAvatarRemoved(false);
      setAvatarStatus(t('profile.avatarSaved'));
      window.dispatchEvent(new Event('ambatu:profile-changed'));
    } catch {
      setAvatarError(t('profile.avatarSaveError'));
    } finally {
      setAvatarSaving(false);
    }
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size >= 3 * 1024 * 1024) {
      setAvatarError(t('profile.avatarFileTooLarge'));
      return;
    }
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setAvatarError(t('profile.avatarFileType'));
      return;
    }
    setAvatarError('');
    setAvatarStatus('');
    setCropFile(file);
  }

  async function submitCroppedAvatar(image: Blob) {
    setAvatarSaving(true);
    setAvatarError('');
    setAvatarStatus('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('No session');
      const uploadedAvatarUrl = await submitCustomProfileAvatar(token, image);
      if (uploadedAvatarUrl) await preloadAvatarImage(uploadedAvatarUrl);
      setAvatarUrl(uploadedAvatarUrl);
      setAvatarId(null);
      setAvatarRemoved(false);
      setCropFile(null);
      setAvatarStatus(t('profile.avatarUploaded'));
      window.dispatchEvent(new Event('ambatu:profile-changed'));
    } catch {
      setAvatarError(t('profile.avatarSaveError'));
    } finally {
      setAvatarSaving(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setProfileError('');
    setProfileStatus('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error(t('profile.connectionError'));
      const profile = await savePlayerProfile(token, {
        username,
        birthDate: birthDate || null,
        bio,
      });
      setUsername(profile.username);
      setDisplayName(profile.username);
      setBirthDate(profile.birthDate ?? '');
      setProfileStatus(t('profile.savedProfile'));
      setBio(profile.bio ?? bio);
      setSavedIdentity({ username: profile.username, bio: profile.bio ?? bio });
      window.dispatchEvent(new Event('ambatu:profile-changed'));
    } catch (error) {
      setProfileError(
        error instanceof PlayerProfileError && error.code === 'username_taken'
          ? t('profile.usernameTaken')
          : t('profile.connectionError'),
      );
    } finally {
      setSaving(false);
    }
  }

  if (profileLoading)
    return (
      <div className="module-loading profile-loading" aria-busy="true">
        <LoadingIndicator label={t('profile.loading')} />
      </div>
    );
  if (profileLoadFailed)
    return (
      <div className="module-loading profile-load-error" role="alert">
        <p>{t('profile.editLoadError')}</p>
        <button className="button secondary compact" type="button" onClick={retryProfileLoad}>
          {t('common.retry')}
        </button>
      </div>
    );

  const displayName = savedIdentity.username || user?.name || t('nav.profile');

  return (
    <div className="dreamy-workspace">
      <header className="dreamy-identity">
        <div className="dreamy-identity-main">
          {user ? (
            <button
              type="button"
              className="dreamy-avatar"
              onClick={() => selectTab('profile')}
              aria-label={t('profile.tabEdit')}
            >
              {avatarUrl && failedAvatar !== avatarUrl ? (
                <img src={avatarUrl} alt="" onError={() => setFailedAvatar(avatarUrl)} />
              ) : (
                <span>{displayName.slice(0, 1).toLocaleUpperCase(locale)}</span>
              )}
              <span className="dreamy-avatar-edit">
                <Camera size={14} aria-hidden="true" />
              </span>
            </button>
          ) : (
            <div className="dreamy-avatar is-guest">
              <Heart size={34} aria-hidden="true" />
            </div>
          )}
          <div className="dreamy-identity-copy">
            <p className="eyebrow">{t(user ? 'nav.profile' : 'profile.eyebrow')}</p>
            <h1>{user ? displayName : t('nav.profile')}</h1>
            <p className="dreamy-bio">
              {user && savedIdentity.bio ? savedIdentity.bio : t('profile.description')}
            </p>
            {user && creator.profile?.joinedAt && (
              <p className="dreamy-joined">
                {t('creator.joined', {
                  date: new Date(creator.profile.joinedAt).toLocaleDateString(locale, {
                    month: 'long',
                    year: 'numeric',
                  }),
                })}
              </p>
            )}
          </div>
        </div>
        {user && (
          <>
            <div className="dreamy-header-actions">
              <button
                className="button secondary compact"
                type="button"
                onClick={() => selectTab('profile')}
              >
                <Pencil size={16} aria-hidden="true" />
                {t('profile.tabEdit')}
              </button>
              <button
                className="dreamy-share-button"
                type="button"
                aria-label={t('profile.shareProfile')}
                title={t('profile.shareProfile')}
                onClick={() => setShareUrl(publicAppUrl('/scroll/profile/', { user: user.id }))}
              >
                <Share2 size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="button secondary compact"
                onClick={() => void leaveProfile()}
              >
                <LogOut size={16} aria-hidden="true" />
                {t('profile.signOut')}
              </button>
              <Link className="dreamy-public-link" href={creatorHref(user.id)}>
                {t('creator.profileLink')}
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <dl className="dreamy-social-counts">
              {(
                [
                  ['creator.followers', creator.profile?.followerCount],
                  ['creator.friends', creator.profile?.friendCount],
                  ['creator.clips', creator.profile?.clipCount],
                ] as const
              ).map(([label, count]) => (
                <div key={label}>
                  <dt>{t(label)}</dt>
                  <dd
                    title={count?.toLocaleString(locale)}
                    aria-label={count?.toLocaleString(locale)}
                  >
                    {count === undefined
                      ? '\u2014'
                      : new Intl.NumberFormat(locale, {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        }).format(count)}
                  </dd>
                </div>
              ))}
            </dl>
            {creator.error && (
              <div className="dreamy-count-error" role="alert">
                <p>{t('profile.connectionError')}</p>
                <button type="button" onClick={creator.refresh}>
                  {t('common.retry')}
                </button>
              </div>
            )}
          </>
        )}
      </header>

      {user && (
        <div className="dreamy-tabs" role="tablist" aria-label={t('nav.profile')}>
          {profileTabs.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              ref={(node) => {
                tabButtons.current[id] = node;
              }}
              id={`dreamy-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={
                {
                  videos: 'my-videos',
                  lores: 'my-lores',
                  sounds: 'my-sounds',
                  profile: 'my-profile-editor',
                  activity: 'my-activity',
                }[id]
              }
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => selectTab(id)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === 'ArrowRight') next = (index + 1) % profileTabs.length;
                else if (event.key === 'ArrowLeft')
                  next = (index + profileTabs.length - 1) % profileTabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = profileTabs.length - 1;
                else return;
                event.preventDefault();
                const tab = profileTabs[next].id;
                selectTab(tab);
                tabButtons.current[tab]?.focus();
              }}
            >
              <Icon size={17} aria-hidden="true" />
              {t(label)}
            </button>
          ))}
        </div>
      )}

      {user && (
        <section
          id="my-videos"
          className="dreamy-tab-panel dreamy-videos"
          role="tabpanel"
          aria-labelledby="dreamy-tab-videos"
          hidden={activeTab !== 'videos'}
        >
          <p className="dreamy-section-hint">{t('profile.videoLibraryHint')}</p>
          <CreatorClips
            key={user.id}
            id={user.id}
            own
            active={activeTab === 'videos'}
            onUpload={() => setUploadOpen(true)}
          />
        </section>
      )}

      {user && (
        <section
          id="my-lores"
          className="dreamy-tab-panel dreamy-contributions-panel"
          role="tabpanel"
          aria-labelledby="dreamy-tab-lores"
          hidden={activeTab !== 'lores'}
        >
          <MyContributions kind="lore" active={activeTab === 'lores'} />
        </section>
      )}

      {user && (
        <section
          id="my-sounds"
          className="dreamy-tab-panel dreamy-contributions-panel"
          role="tabpanel"
          aria-labelledby="dreamy-tab-sounds"
          hidden={activeTab !== 'sounds'}
        >
          <MyContributions kind="sound" active={activeTab === 'sounds'} />
        </section>
      )}

      <section
        id="my-profile-editor"
        className="dreamy-tab-panel"
        role={user ? 'tabpanel' : undefined}
        aria-labelledby={user ? 'dreamy-tab-profile' : undefined}
        hidden={Boolean(user) && activeTab !== 'profile'}
      >
        {!configured || !user ? (
          <div className="dreamy-guest-card">
            <LogIn size={26} aria-hidden="true" />
            <div>
              <h2>{t('profile.home')}</h2>
              <p>{t(configured ? 'profile.googlePrompt' : 'profile.guest')}</p>
            </div>
            {configured ? (
              <button
                type="button"
                className="button dark"
                disabled={!ready}
                onClick={() => void signInWithGoogle()}
              >
                <LogIn size={17} aria-hidden="true" />
                {t('profile.googleSignIn')}
              </button>
            ) : (
              <p className="note-panel">{t('profile.notConnected')}</p>
            )}
          </div>
        ) : (
          <>
            <form className="dreamy-editor" onSubmit={saveProfile}>
              <div className="dreamy-profile-fields">
                <div className="dreamy-section-heading">
                  <Pencil size={19} aria-hidden="true" />
                  <h2>{t('profile.editTitle')}</h2>
                </div>
                <p className="dreamy-section-hint">{t('profile.editHint')}</p>
                <label>
                  {t('profile.username')}
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    minLength={2}
                    maxLength={24}
                    required
                    autoComplete="nickname"
                  />
                </label>
                <label>
                  {t('creator.bio')}
                  <textarea
                    value={bio}
                    maxLength={280}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder={t('creator.bioHint')}
                  />
                  <span className="dreamy-character-count" aria-hidden="true">
                    {bio.length}/280
                  </span>
                </label>
                <label>
                  {t('profile.birthDate')}
                  <input
                    type="date"
                    value={birthDate}
                    max={today()}
                    onChange={(event) => setBirthDate(event.target.value)}
                  />
                </label>
                {profileError && (
                  <p className="form-error" role="alert">
                    {profileError}
                  </p>
                )}
                {profileStatus && (
                  <p className="form-success" role="status">
                    {profileStatus}
                  </p>
                )}
                <div className="dreamy-editor-actions">
                  <button className="button dreamy-save-button" type="submit" disabled={saving}>
                    <Save size={17} aria-hidden="true" />
                    {t(saving ? 'profile.savingProfile' : 'profile.saveProfile')}
                  </button>
                </div>
              </div>

              <section className="dreamy-avatar-settings" aria-labelledby="profile-avatar-heading">
                <div className="dreamy-avatar-settings-heading">
                  <div>
                    <h2 id="profile-avatar-heading">{t('profile.avatarHeading')}</h2>
                    <p>{t('profile.avatarHint')}</p>
                  </div>
                  <div className="dreamy-current-avatar">
                    {avatarUrl && failedAvatar !== avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={t('profile.currentAvatar')}
                        onError={() => setFailedAvatar(avatarUrl)}
                      />
                    ) : (
                      <span>{displayName.slice(0, 1).toLocaleUpperCase(locale)}</span>
                    )}
                  </div>
                </div>
                <p className="dreamy-avatar-note">{t('profile.avatarNotice')}</p>
                <p className="dreamy-presets-label">{t('profile.avatarPresets')}</p>
                <div className="dreamy-avatar-grid">
                  <button
                    type="button"
                    className="dreamy-avatar-option"
                    aria-label={t('profile.avatarDefault')}
                    aria-pressed={!avatarId && !avatarUrl}
                    disabled={avatarSaving}
                    onClick={() => void chooseAvatar(null)}
                  >
                    <span>{displayName.slice(0, 1).toLocaleUpperCase(locale)}</span>
                    <small>{t('profile.avatarDefault')}</small>
                  </button>
                  {avatars.map((avatar) => (
                    <button
                      type="button"
                      key={avatar.id}
                      className="dreamy-avatar-option"
                      aria-label={t('profile.chooseAvatar', { name: avatar.name })}
                      aria-pressed={avatarId === avatar.id}
                      disabled={avatarSaving}
                      onClick={() => void chooseAvatar(avatar.id)}
                    >
                      {avatar.imageUrl ? (
                        <img src={avatar.imageUrl} loading="lazy" alt="" />
                      ) : (
                        <span>{avatar.name.slice(0, 1)}</span>
                      )}
                      <small>{avatar.name}</small>
                    </button>
                  ))}
                </div>
                {!avatars.length && (
                  <p className="dreamy-section-hint">{t('profile.avatarNoPresets')}</p>
                )}
                <label className="dreamy-avatar-upload">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={selectImage}
                    disabled={avatarSaving}
                  />
                  <Camera size={17} aria-hidden="true" />
                  <span>{t('profile.avatarCustomUpload')}</span>
                </label>
                <p className="dreamy-section-hint">{t('profile.avatarFileHint')}</p>
                {avatarRemoved && (
                  <p className="dreamy-avatar-note" role="status">
                    {t('profile.avatarRemoved')}
                  </p>
                )}
                {avatarError && (
                  <p className="form-error" role="alert">
                    {avatarError}
                  </p>
                )}
                {avatarStatus && (
                  <p className="form-success" role="status">
                    {avatarStatus}
                  </p>
                )}
              </section>
            </form>
            <div className="dreamy-account-strip">
              <div>
                <h2>{t('profile.accountHeading')}</h2>
                <p>{t('profile.signedInAs', { email: user.email })}</p>
              </div>
            </div>
          </>
        )}
      </section>

      <section
        id="my-activity"
        className="dreamy-tab-panel dreamy-activity"
        role={user ? 'tabpanel' : undefined}
        aria-labelledby={user ? 'dreamy-tab-activity' : 'dreamy-activity-heading'}
        hidden={Boolean(user) && activeTab !== 'activity'}
      >
        <div className="dreamy-section-heading">
          <BarChart3 size={20} aria-hidden="true" />
          <h2 id="dreamy-activity-heading">{t('profile.tabActivity')}</h2>
        </div>
        <p className="dreamy-section-hint">{t('profile.saved')}</p>
        <div className="dreamy-activity-metrics">
          <div>
            <Heart size={21} aria-hidden="true" />
            <strong>{favorites.length.toLocaleString(locale)}</strong>
            <span>{t('profile.favoriteSounds')}</span>
          </div>
          <div>
            <Volume2 size={21} aria-hidden="true" />
            <strong>{plays.toLocaleString(locale)}</strong>
            <span>{t('profile.soundsPlayed')}</span>
          </div>
        </div>
        <div className="dreamy-section-heading">
          <Trophy size={20} aria-hidden="true" />
          <h3>{t('profile.personalBests')}</h3>
        </div>
        <div className="dreamy-game-scores">
          {games.map((game) => (
            <div className="dreamy-game-score" key={game.id}>
              <img src={game.image} alt="" loading="lazy" />
              <span>{game.name}</span>
              <strong>{(scores[game.id] || 0).toLocaleString(locale)}</strong>
            </div>
          ))}
        </div>
        <p className="dreamy-section-hint dreamy-local-note">{t('profile.localSave')}</p>
      </section>

      {shareUrl && <ChatShareDialog url={shareUrl} creator onClose={() => setShareUrl('')} />}
      {cropFile && (
        <AvatarCropDialog
          file={cropFile}
          title={t('profile.avatarCropTitle')}
          help={t('profile.avatarCropHelp')}
          zoomLabel={t('profile.avatarZoom')}
          cancelLabel={t('profile.avatarCancel')}
          useImageLabel={t(avatarSaving ? 'profile.avatarSaving' : 'profile.avatarUseImage')}
          busy={avatarSaving}
          onCancel={() => setCropFile(null)}
          onComplete={(image) => void submitCroppedAvatar(image)}
        />
      )}
      {uploadOpen && user && (
        <VideoUploadDialog
          onClose={() => setUploadOpen(false)}
          onPublished={() => {
            window.dispatchEvent(new Event('ambatu:clips-changed'));
            selectTab('videos');
          }}
        />
      )}
    </div>
  );
}
