'use client';
import Link from 'next/link';
import { ArrowLeft, Check, MessageCircle, Pencil, UserCheck, UserPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { memberApi } from '@/lib/member-api';
import type { CreatorProfile as Profile } from '@/lib/creator-profile';
import { creatorHref } from '@/lib/creator-profile';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { useFriendRequests } from './friend-request-provider';
import { LoadingIndicator } from './loading-indicator';
import { useCreatorProfile } from './use-creator-profile';
import { CreatorClips } from './creator-clips';
import './creator-profile.css';

export function CreatorProfile({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const { t, locale } = useI18n();
  const { user, getIdToken } = useAuth();
  const { refresh: refreshRequests } = useFriendRequests();
  const { profile, setProfile, loading, error, refresh } = useCreatorProfile(id);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState('');
  const pending = useRef(false);
  const own = user?.id === id;
  async function act(action: 'follow' | 'unfollow' | 'accept') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setActionError(false);
    try {
      const result = await memberApi<Profile>(
        `/creators/${encodeURIComponent(id)}/follow`,
        await getIdToken(),
        undefined,
        { action },
      );
      setProfile(result);
      refreshRequests();
      window.dispatchEvent(new Event('ambatu:friends-changed'));
    } catch {
      setActionError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const Heading = embedded ? 'h2' : 'h1';
  return (
    <div className={`creator-content${embedded ? ' is-embedded' : ''}`}>
      {!embedded && (
        <Link className="creator-back" href="/scroll/">
          <ArrowLeft size={18} />
          {t('creator.back')}
        </Link>
      )}
      {!profile && loading && (
        <div className="creator-profile-loading">
          <LoadingIndicator label={t('profile.loading')} />
        </div>
      )}
      {error && (
        <div className="creator-error" role="alert">
          <p>{t('creator.loadError')}</p>
          <button className="button secondary compact" type="button" onClick={refresh}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {profile && (
        <>
          <section className="creator-hero">
            <div className="creator-avatar" aria-hidden="true">
              {profile.avatarUrl && avatarFailed !== profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  onError={() => setAvatarFailed(profile.avatarUrl!)}
                />
              ) : (
                <span>{profile.username.slice(0, 1).toLocaleUpperCase()}</span>
              )}
            </div>
            <div className="creator-hero-copy">
              <p className="eyebrow">{t(own ? 'nav.profile' : 'creator.title')}</p>
              <Heading>{profile.username || t('creator.title')}</Heading>
              {profile.bio && <p className="creator-bio">{profile.bio}</p>}
              {profile.joinedAt && (
                <p className="creator-joined">
                  {t('creator.joined', {
                    date: new Date(profile.joinedAt).toLocaleDateString(locale, {
                      month: 'long',
                      year: 'numeric',
                    }),
                  })}
                </p>
              )}
            </div>
            <dl className="creator-counts">
              <div>
                <dt>{t('creator.followers')}</dt>
                <dd>{profile.followerCount.toLocaleString(locale)}</dd>
              </div>
              <div>
                <dt>{t('creator.friends')}</dt>
                <dd>{profile.friendCount.toLocaleString(locale)}</dd>
              </div>
              <div>
                <dt>{t('creator.clips')}</dt>
                <dd>{profile.clipCount.toLocaleString(locale)}</dd>
              </div>
            </dl>
            <div className="creator-actions">
              {own ? (
                <Link
                  className="button secondary"
                  href={embedded ? '#my-profile-editor' : '/profile/#my-profile-editor'}
                >
                  <Pencil size={17} />
                  {t('creator.editProfile')}
                </Link>
              ) : (
                <>
                  <button
                    className={`button ${profile.following ? 'secondary' : 'dark'}`}
                    type="button"
                    disabled={busy}
                    onClick={() => void act(profile.following ? 'unfollow' : 'follow')}
                    aria-label={
                      profile.following
                        ? t('creator.unfollow', { name: profile.username })
                        : undefined
                    }
                    aria-pressed={profile.following}
                  >
                    {profile.following ? <Check size={18} /> : <UserPlus size={18} />}{' '}
                    {t(profile.following ? 'creator.following' : 'creator.follow')}
                  </button>
                  {profile.friendState === 'incoming' && (
                    <button
                      className="button dark"
                      type="button"
                      disabled={busy}
                      onClick={() => void act('accept')}
                    >
                      <UserCheck size={18} />
                      {t('creator.accept')}
                    </button>
                  )}
                  {profile.friendState === 'accepted' && (
                    <>
                      <span className="creator-friend-badge">
                        <UserCheck size={16} />
                        {t('creator.friends')}
                      </span>
                      <Link
                        className="button secondary"
                        href={`/chat/?user=${encodeURIComponent(id)}&name=${encodeURIComponent(profile.username)}`}
                      >
                        <MessageCircle size={17} />
                        {t('chat.startChat')}
                      </Link>
                    </>
                  )}
                </>
              )}
              {own && embedded && (
                <Link className="button secondary" href={creatorHref(id)}>
                  {t('creator.profileLink')}
                </Link>
              )}
            </div>
            {!own && (
              <div className="creator-connection-note" aria-live="polite">
                {profile.friendState === 'outgoing' ? (
                  <p>
                    <UserPlus size={16} />
                    {t('creator.pending')}
                  </p>
                ) : profile.friendState === 'incoming' ? (
                  <p>{t('creator.incoming', { name: profile.username })}</p>
                ) : (
                  profile.friendState !== 'accepted' && <p>{t('creator.followHint')}</p>
                )}
                {actionError && (
                  <p className="form-error" role="alert">
                    {t('creator.relationshipError')}
                  </p>
                )}
              </div>
            )}
          </section>
          <CreatorClips key={id} id={id} own={own} />
        </>
      )}
    </div>
  );
}
