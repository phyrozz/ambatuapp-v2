'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowUpRight, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from './app-provider';
import { games } from '@/lib/catalog';
import { fetchJson, parseProfile, type Profile } from '@/lib/feeds';
import { useI18n } from './i18n-provider';
const endpoint = process.env.NEXT_PUBLIC_PROFILE_FEED_URL;
export function ProfilePanel() {
  const { t } = useI18n();
  const { favorites, scores, plays } = useApp();
  const [session, setSession] = useState<Session | null>(null),
    [mode, setMode] = useState<'login' | 'signup'>('login'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        setSession(data.session);
        if (error) setMessage(error.message);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email'));
    const password = String(data.get('password') || '');
    try {
      {
        const { error } =
          mode === 'login'
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (mode === 'signup')
          setMessage(t('profile.created'));
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('profile.connectionError'));
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMessage(t('profile.signedOut'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('profile.signOutError'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="account-grid">
        <section className="panel">
          <h2>{t('profile.corner')}</h2>
          <p>{t('profile.saved')}</p>
          <div className="stats-grid">
            <div className="stat">
              <b>{favorites.length}</b>
              <span>{t('profile.favoriteSounds')}</span>
            </div>
            <div className="stat">
              <b>{plays}</b>
              <span>{t('profile.soundsPlayed')}</span>
            </div>
          </div>
          <p className="eyebrow">{t('profile.personalBests')}</p>
          {games.map((g) => (
            <div className="score-row" key={g.id}>
              <span>{g.name}</span>
              <b>{scores[g.id] || 0}</b>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>
            {session
              ? t('profile.signedIn')
              : mode === 'signup'
                ? t('profile.join')
                : t('profile.home')}
          </h2>
          {!supabase ? (
            <>
              <p>
                {t('profile.guest')}
              </p>
              <div className="note-panel">{t('profile.notConnected')}</div>
            </>
          ) : session ? (
            <>
              <p>
                {t('profile.signedInAs', { email: session.user.email ?? '' })}
              </p>
              <p>{t('profile.localSave')}</p>
              <button className="button secondary" disabled={busy} onClick={() => void signOut()}>
                <LogOut size={17} />
                {t('profile.signOut')}
              </button>
            </>
          ) : (
            <>
              <p>
                {mode === 'signup'
                  ? t('profile.createPrompt')
                  : t('profile.signInPrompt')}
              </p>
              <form className="account-form" onSubmit={submit}>
                <label>
                  {t('profile.email')}
                  <input
                    name="email"
                    autoComplete="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                  />
                </label>
                {
                  <label>
                    {t('profile.password')}
                    <input
                      name="password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      type="password"
                      required
                      minLength={6}
                      placeholder={t('profile.passwordPlaceholder')}
                    />
                  </label>
                }
                <button type="submit" disabled={busy} className="button dark">
                  <LogIn size={17} />
                  {busy ? t('profile.wait') : mode === 'signup' ? t('profile.create') : t('profile.signIn')}
                </button>
              </form>
              <button
                className="auth-toggle"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setMessage('');
                }}
              >
                {mode === 'login' ? t('profile.newHere') : t('profile.member')}
              </button>
            </>
          )}
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
        </section>
      </div>
      {/* <DreamyStats /> */}
    </>
  );
}
// function DreamyStats() {
//   const { t } = useI18n();
//   const [profile, setProfile] = useState<Profile | null>(null),
//     [error, setError] = useState(''),
//     [attempt, setAttempt] = useState(0);
//   useEffect(() => {
//     if (!endpoint) return;
//     const controller = new AbortController();
//     fetchJson(endpoint, controller.signal)
//       .then(parseProfile)
//       .then(setProfile)
//       .catch((e) => {
//         if (!controller.signal.aborted)
//           setError(e instanceof Error ? e.message : t('profile.loadError'));
//       });
//     return () => controller.abort();
//   }, [attempt, t]);
//   return (
//     <section className="panel profile-feed">
//       <p className="eyebrow">{t('profile.originalEyebrow')}</p>
//       <h2>{profile?.name || t('profile.originalTitle')}</h2>
//       {profile ? (
//         <>
//           {profile.image && <img className="profile-avatar" src={profile.image} alt="" />}
//           <p>
//             @{profile.handle} · {profile.bio}
//           </p>
//           <div className="stats-grid">
//             <div className="stat">
//               <b>{profile.followers.toLocaleString()}</b>
//               <span>{t('profile.followers')}</span>
//             </div>
//             <div className="stat">
//               <b>{profile.following.toLocaleString()}</b>
//               <span>{t('profile.following')}</span>
//             </div>
//           </div>
//         </>
//       ) : error ? (
//         <div role="alert">
//           <p>{error}</p>
//           <button
//             className="button secondary compact"
//             onClick={() => {
//               setError('');
//               setAttempt((a) => a + 1);
//             }}
//           >
//             <RefreshCw size={15} />
//             {t('common.retry')}
//           </button>
//         </div>
//       ) : (
//         <p>
//           {endpoint
//             ? t('profile.loading')
//             : t('profile.liveUnavailable')}
//         </p>
//       )}
//       <a
//         className="button secondary compact"
//         href="https://www.twitter.com/dreamybullxxx"
//         target="_blank"
//         rel="noopener noreferrer"
//       >
//         {t('profile.visit')}
//         <ArrowUpRight size={16} />
//       </a>
//     </section>
//   );
// }
