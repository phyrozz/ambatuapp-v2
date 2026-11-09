'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { dreamApi, dreamErrorKey, dreamRequestKey, type DreamVotes } from '@/lib/ambatupost';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';

type Value = -1 | 0 | 1;
const display = (confirmed: DreamVotes, value: Value): DreamVotes => ({
  up: confirmed.up - Number(confirmed.viewerVote === 1) + Number(value === 1),
  down: confirmed.down - Number(confirmed.viewerVote === -1) + Number(value === -1),
  viewerVote: value,
});

export function DreamCommentVotes({
  initial,
  path,
  getToken,
  onSignIn,
  onFailure,
}: {
  initial: DreamVotes;
  path: string;
  getToken: () => Promise<string | null>;
  onSignIn: () => void;
  onFailure: (error: unknown) => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [votes, setVotes] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmed = useRef(initial);
  const desired = useRef({ value: initial.viewerVote, generation: 0 });
  const attempt = useRef<{ value: Value; generation: number; key: string } | null>(null);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    return () => controller.abort();
  }, []);
  async function flush() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const controller = request.current;
    try {
      do {
        attempt.current ??= { ...desired.current, key: dreamRequestKey() };
        const current = attempt.current;
        const result = await dreamApi<DreamVotes>(path, await getToken(), {
          method: 'POST',
          body: { value: current.value },
          key: current.key,
          signal: controller?.signal,
        });
        if (controller?.signal.aborted) return;
        confirmed.current = result;
        if (desired.current.generation === current.generation)
          desired.current.value = result.viewerVote;
        attempt.current = null;
        setVotes(display(result, desired.current.value));
      } while (desired.current.value !== confirmed.current.viewerVote);
    } catch (reason) {
      if (controller?.signal.aborted) return;
      onFailure(reason);
      setError(dreamErrorKey(reason));
    } finally {
      pending.current = false;
      if (!controller?.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="dream-comment-voting">
      <div className="dream-votes" role="group" aria-label={t('post.commentVotes')}>
        {([1, -1] as const).map((direction) => {
          const Icon = direction === 1 ? ArrowUp : ArrowDown;
          const count = direction === 1 ? votes.up : votes.down;
          return (
            <button
              key={direction}
              type="button"
              className={`dream-vote${votes.viewerVote === direction ? ' selected' : ''}`}
              aria-pressed={votes.viewerVote === direction}
              aria-label={t(
                direction === 1 ? 'post.commentUpvoteLabel' : 'post.commentDownvoteLabel',
                { count },
              )}
              onClick={() => {
                if (!user) {
                  onSignIn();
                  return;
                }
                desired.current = {
                  value: desired.current.value === direction ? 0 : direction,
                  generation: desired.current.generation + 1,
                };
                setVotes(display(confirmed.current, desired.current.value));
                void flush();
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>
      <span className="sr-only" role="status">
        {t('post.voteSummary', { up: votes.up, down: votes.down })}
      </span>
      {error && (
        <div className="dream-comment-error" role="alert">
          <p>{t(error)}</p>
          <button
            type="button"
            className="dream-comment-text-button"
            disabled={busy}
            onClick={() => (error === 'post.signInAgain' ? onSignIn() : void flush())}
          >
            {t(error === 'post.signInAgain' ? 'profile.googleSignIn' : 'common.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
