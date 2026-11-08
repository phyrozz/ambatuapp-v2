'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Share2 } from 'lucide-react';
import {
  dreamApi,
  DreamApiError,
  dreamErrorKey,
  dreamRequestKey,
  type Dream,
  type DreamVotes,
} from '@/lib/ambatupost';
import { publicAppUrl } from '@/lib/share-links';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { ClipSharePickerDialog } from './clip-share-picker-dialog';
import { ClipShareLink } from './clip-share-link';
import { FriendsDialog } from './friends-dialog';

type VoteValue = -1 | 0 | 1;

function displayVotes(confirmed: DreamVotes, value: VoteValue): DreamVotes {
  return {
    up: confirmed.up - Number(confirmed.viewerVote === 1) + Number(value === 1),
    down: confirmed.down - Number(confirmed.viewerVote === -1) + Number(value === -1),
    viewerVote: value,
  };
}

export function DreamActions({
  dream,
  getToken,
  onUnavailable,
}: {
  dream: Dream;
  getToken: () => Promise<string | null>;
  onUnavailable: () => void;
}) {
  const { t } = useI18n();
  const { user, configured, signInWithGoogle } = useAuth();
  const initial = dream.votes ?? { up: 0, down: 0, viewerVote: 0 };
  const [votes, setVotes] = useState<DreamVotes>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryNeeded, setRetryNeeded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [signInPrompt, setSignInPrompt] = useState(false);
  const confirmed = useRef<DreamVotes>(initial);
  const desired = useRef<{ value: VoteValue; generation: number }>({ value: initial.viewerVote, generation: 0 });
  const attempt = useRef<{ value: VoteValue; generation: number; key: string } | null>(null);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    return () => controller.abort();
  }, []);

  async function signIn() {
    try {
      await signInWithGoogle(`${window.location.pathname}${window.location.search}`);
    } catch {
      setError('post.error');
    }
  }
  async function flushVotes() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const controller = request.current;
    try {
      do {
        attempt.current ??= { ...desired.current, key: dreamRequestKey() };
        const current = attempt.current;
        const result = await dreamApi<DreamVotes>(`/${dream.id}/vote`, await getToken(), {
          method: 'POST',
          body: { value: current.value },
          key: current.key,
          signal: controller?.signal,
        });
        if (controller?.signal.aborted) return;
        confirmed.current = result;
        // A retry can return a newer server vote. Respect it unless the user clicked again.
        if (desired.current.generation === current.generation)
          desired.current.value = result.viewerVote;
        attempt.current = null;
        setVotes(displayVotes(result, desired.current.value));
        setRetryNeeded(false);
      } while (desired.current.value !== confirmed.current.viewerVote);
    } catch (reason) {
      if (controller?.signal.aborted) return;
      if (reason instanceof DreamApiError && [404, 410].includes(reason.status)) {
        onUnavailable();
        return;
      }
      setError(dreamErrorKey(reason));
      setRetryNeeded(true);
    } finally {
      pending.current = false;
      if (!controller?.signal.aborted) setBusy(false);
    }
  }
  function vote(direction: -1 | 1) {
    if (!user) {
      setSignInPrompt(true);
      return;
    }
    desired.current = {
      value: desired.current.value === direction ? 0 : direction,
      generation: desired.current.generation + 1,
    };
    setVotes(displayVotes(confirmed.current, desired.current.value));
    setError('');
    setRetryNeeded(false);
    void flushVotes();
  }
  const shareUrl = sharing ? publicAppUrl('/ambatupost/', { dream: dream.id }) : '';
  return (
    <>
      <div className="dream-engagement">
        <div className="dream-votes" role="group" aria-label={t('post.votes')}>
          {([1, -1] as const).map((direction) => {
            const up = direction === 1;
            const Icon = up ? ArrowUp : ArrowDown;
            const count = up ? votes.up : votes.down;
            return (
              <button
                key={direction}
                type="button"
                className={`dream-vote${votes.viewerVote === direction ? ' selected' : ''}`}
                aria-pressed={votes.viewerVote === direction}
                aria-label={t(up ? 'post.upvoteLabel' : 'post.downvoteLabel', { count })}
                title={t(up ? 'post.upvoteHint' : 'post.downvoteHint')}
                onClick={() => vote(direction)}
              >
                <Icon size={18} aria-hidden="true" />
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>
        <button type="button" className="dream-share" aria-label={t('chat.share')} onClick={() => setSharing(true)}>
          <Share2 size={18} aria-hidden="true" />
        </button>
      </div>
      <span className="sr-only" role="status">
        {t('post.voteSummary', { up: votes.up, down: votes.down })}
      </span>
      {error && (
        <div className="dream-notice" role="alert">
          <p>{t(error)}</p>
          {error === 'post.signInAgain' && (
            <button type="button" className="button dark" disabled={!configured} onClick={() => void signIn()}>
              {t('profile.googleSignIn')}
            </button>
          )}
          {retryNeeded && (
            <button
              type="button"
              className="button secondary compact"
              disabled={busy}
              onClick={() => void flushVotes()}
            >
              {t('common.retry')}
            </button>
          )}
        </div>
      )}
      {signInPrompt && (
        <FriendsDialog title={t('post.voteSignIn')} onClose={() => setSignInPrompt(false)}>
          <button
            type="button"
            className="button dark"
            disabled={!configured}
            onClick={() => void signIn()}
          >
            {t('profile.googleSignIn')}
          </button>
        </FriendsDialog>
      )}
      {sharing &&
        (user ? (
          <ClipSharePickerDialog
            title={t('post.sharedDream')}
            description={t('post.shareHint')}
            message={shareUrl}
            url={shareUrl}
            onClose={() => setSharing(false)}
          />
        ) : (
          <FriendsDialog
            title={t('chat.share')}
            description={t('post.shareHint')}
            onClose={() => setSharing(false)}
          >
            <ClipShareLink title={t('post.sharedDream')} url={shareUrl} />
            <p className="dream-helper">{t('post.shareSignIn')}</p>
            <button
              type="button"
              className="button dark"
              disabled={!configured}
              onClick={() => void signIn()}
            >
              {t('profile.googleSignIn')}
            </button>
          </FriendsDialog>
        ))}
    </>
  );
}
