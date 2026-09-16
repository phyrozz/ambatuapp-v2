'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowUpRight, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from './app-provider';
import { games } from '@/lib/catalog';
import { fetchJson, parseProfile, type Profile } from '@/lib/feeds';
const endpoint = process.env.NEXT_PUBLIC_PROFILE_FEED_URL;
export function ProfilePanel() {
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
          setMessage(
            'Account created. Check your email to confirm your address before signing in.',
          );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not connect. Please try again.');
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
      setMessage('Signed out.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="account-grid">
        <section className="panel">
          <h2>Your little corner.</h2>
          <p>Good times, saved on this device.</p>
          <div className="stats-grid">
            <div className="stat">
              <b>{favorites.length}</b>
              <span>FAVORITE SOUNDS</span>
            </div>
            <div className="stat">
              <b>{plays}</b>
              <span>SOUNDS PLAYED</span>
            </div>
          </div>
          <p className="eyebrow">PERSONAL BESTS</p>
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
              ? 'You’re in the club.'
              : mode === 'signup'
                ? 'Join the club.'
                : 'Make yourself at home.'}
          </h2>
          {!supabase ? (
            <>
              <p>
                You’re exploring as a guest. The arcade, soundboard, and your local collection are
                ready to go.
              </p>
              <div className="note-panel">Account sign-in hasn’t been connected yet.</div>
            </>
          ) : session ? (
            <>
              <p>
                Signed in as <strong>{session.user.email}</strong>.
              </p>
              <p>Favorites and game scores are saved on this device.</p>
              <button className="button secondary" disabled={busy} onClick={() => void signOut()}>
                <LogOut size={17} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <p>
                {mode === 'signup'
                  ? 'Create your AmbatuApp account.'
                  : 'Sign in with your AmbatuApp account.'}
              </p>
              <form className="account-form" onSubmit={submit}>
                <label>
                  Email
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
                    Password
                    <input
                      name="password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      type="password"
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                    />
                  </label>
                }
                <button type="submit" disabled={busy} className="button dark">
                  <LogIn size={17} />
                  {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </form>
              <button
                className="auth-toggle"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setMessage('');
                }}
              >
                {mode === 'login' ? 'New here? Create an account' : 'Already a member? Sign in'}
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
      <DreamyStats />
    </>
  );
}
function DreamyStats() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    fetchJson(endpoint, controller.signal)
      .then(parseProfile)
      .then(setProfile)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Profile could not load.');
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <section className="panel profile-feed">
      <p className="eyebrow">MYDREAMY · THE ORIGINAL PROFILE</p>
      <h2>{profile?.name || 'The one who started it all.'}</h2>
      {profile ? (
        <>
          {profile.image && <img className="profile-avatar" src={profile.image} alt="" />}
          <p>
            @{profile.handle} · {profile.bio}
          </p>
          <div className="stats-grid">
            <div className="stat">
              <b>{profile.followers.toLocaleString()}</b>
              <span>FOLLOWERS</span>
            </div>
            <div className="stat">
              <b>{profile.following.toLocaleString()}</b>
              <span>FOLLOWING</span>
            </div>
          </div>
        </>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            className="button secondary compact"
            onClick={() => {
              setError('');
              setAttempt((a) => a + 1);
            }}
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      ) : (
        <p>
          {endpoint
            ? 'Loading profile…'
            : 'Live profile stats aren’t connected. You can visit the original profile on X.'}
        </p>
      )}
      <a
        className="button secondary compact"
        href="https://www.twitter.com/dreamybullxxx"
        target="_blank"
        rel="noopener noreferrer"
      >
        Visit original profile
        <ArrowUpRight size={16} />
      </a>
    </section>
  );
}
