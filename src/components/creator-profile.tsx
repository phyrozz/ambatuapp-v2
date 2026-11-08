'use client';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Check, Film, Gamepad2, MessageCircle, MoreHorizontal, Newspaper, Pencil, UserCheck, UserPlus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { memberApi } from '@/lib/member-api';
import type { CreatorProfile as Profile } from '@/lib/creator-profile';
import { creatorHref } from '@/lib/creator-profile';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { useFriendRequests } from './friend-request-provider';
import { LoadingIndicator } from './loading-indicator';
import { useCreatorProfile } from './use-creator-profile';
import { CreatorClips } from './creator-clips';
import { CreatorDreams, CreatorLores, CreatorScores } from './creator-activity';
import './creator-profile.css';
import { PlayerBlockButton } from './player-block-controls';

export function CreatorProfile({
  id,
  embedded = false,
  fromPost = false,
}: {
  id: string;
  embedded?: boolean;
  fromPost?: boolean;
}) {
  const { t, locale } = useI18n();
  const { user, getIdToken, configured, signInWithGoogle } = useAuth();
  const { refresh: refreshRequests } = useFriendRequests();
  const { profile, setProfile, loading, error, refresh } = useCreatorProfile(id);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsId = useId();
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionsOpen) return;
    const outside = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActionsOpen(false);
        actionsRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [actionsOpen]);
  const [tab, setTab] = useState<'dreams' | 'videos' | 'lores' | 'scores'>(
    process.env.NEXT_PUBLIC_AMBATUPOST_ENABLED === 'true' ? 'dreams' : 'videos',
  );
  const tabsRef = useRef<HTMLDivElement>(null);
  const profileId = profile?.id;
  useEffect(() => {
    const reveal = () => {
      const container = tabsRef.current;
      const current = container?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!container || !current) return;
      const bounds = container.getBoundingClientRect(),
        selected = current.getBoundingClientRect();
      if (selected.right > bounds.right) container.scrollLeft += selected.right - bounds.right;
      else if (selected.left < bounds.left) container.scrollLeft -= bounds.left - selected.left;
    };
    reveal();
    window.addEventListener('resize', reveal);
    return () => window.removeEventListener('resize', reveal);
  }, [tab, profileId]);
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
  const contentTabs = [
    ...(process.env.NEXT_PUBLIC_AMBATUPOST_ENABLED === 'true'
      ? [{ id: 'dreams', label: 'creator.tabDreams', icon: Newspaper } as const]
      : []),
    { id: 'videos', label: 'profile.tabVideos', icon: Film },
    { id: 'lores', label: 'profile.tabLore', icon: BookOpen },
    { id: 'scores', label: 'creator.tabScores', icon: Gamepad2 },
  ] as const;
  return (
    <div className={`creator-content${embedded ? ' is-embedded' : ''}`}>
      {!embedded && (
        <Link className="creator-back" href={fromPost ? '/ambatupost/' : '/scroll/'}>
          <ArrowLeft size={18} />
          {t(fromPost ? 'post.back' : 'creator.back')}
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
            {!own && user && (
              <div className="creator-more" ref={actionsRef}>
                <button
                  type="button"
                  className="creator-more-trigger"
                  aria-label={t('chat.moreActions')}
                  aria-expanded={actionsOpen}
                  aria-controls={actionsId}
                  onClick={() => setActionsOpen((open) => !open)}
                >
                  <MoreHorizontal size={21} />
                </button>
                <div
                  id={actionsId}
                  className="creator-more-menu"
                  data-open={actionsOpen}
                  aria-hidden={!actionsOpen}
                  inert={!actionsOpen}
                >
                  {profile.friendState === 'accepted' && (
                    <Link href={`/chat/?user=${encodeURIComponent(id)}&name=${encodeURIComponent(profile.username)}`}>
                      <MessageCircle size={17} />
                      {t('chat.startChat')}
                    </Link>
                  )}
                  <PlayerBlockButton
                    playerId={id}
                    name={profile.username}
                    onOpen={() => setActionsOpen(false)}
                    onBlocked={() => {
                      setProfile(null);
                      refresh();
                    }}
                  />
                </div>
              </div>
            )}
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
              <Heading>{profile.username || t('lore.anonymous')}</Heading>
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
              ) : user ? (
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
                    </>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="button dark"
                  disabled={!configured}
                  onClick={() =>
                    void signInWithGoogle(creatorHref(id)).catch(() => setActionError(true))
                  }
                >
                  {t('profile.googleSignIn')}
                </button>
              )}
              {!user && actionError && (
                <p className="form-error" role="alert">
                  {t('profile.connectionError')}
                </p>
              )}
              {own && embedded && (
                <Link className="button secondary" href={creatorHref(id)}>
                  {t('creator.view', { name: profile.username })}
                </Link>
              )}
            </div>
            {!own && user && (
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
          <div
            ref={tabsRef}
            className="creator-content-tabs"
            role="tablist"
            aria-label={profile.username || t('lore.anonymous')}
          >
            {contentTabs.map((item, index, all) => (
              <button
                key={item.id}
                id={`creator-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`creator-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={(event) => {
                  setTab(item.id);
                  event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }}
                onKeyDown={(event) => {
                  let next: number;
                  if (event.key === 'ArrowRight') next = (index + 1) % all.length;
                  else if (event.key === 'ArrowLeft') next = (index + all.length - 1) % all.length;
                  else if (event.key === 'Home') next = 0;
                  else if (event.key === 'End') next = all.length - 1;
                  else return;
                  event.preventDefault();
                  setTab(all[next].id);
                  document.getElementById(`creator-tab-${all[next].id}`)?.focus();
                }}
              >
                <item.icon size={17} aria-hidden="true" />
                {t(item.label)}
              </button>
            ))}
          </div>
          {contentTabs.map((item) => (
            <section
              key={item.id}
              id={`creator-panel-${item.id}`}
              className="creator-tab-panel"
              role="tabpanel"
              aria-labelledby={`creator-tab-${item.id}`}
              hidden={tab !== item.id}
            >
              {tab === item.id && tab === 'dreams' && (
                <CreatorDreams key={`${id}:${user?.id ?? 'guest'}`} id={id} />
              )}
              {tab === item.id && tab === 'videos' && (
                <CreatorClips key={`${id}:${user?.id ?? 'guest'}`} id={id} own={own} />
              )}
              {tab === item.id && tab === 'lores' && (
                <CreatorLores key={`${id}:${user?.id ?? 'guest'}`} id={id} />
              )}
              {tab === item.id && tab === 'scores' && (
                <CreatorScores key={`${id}:${user?.id ?? 'guest'}`} id={id} />
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
