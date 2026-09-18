'use client';
import { useEffect, useState } from 'react';
import { Sparkles, Trophy, WifiOff } from 'lucide-react';
import { getLeaderboard, leaderboardConfigured, type LeaderboardEntry } from '@/lib/leaderboard';
import { useI18n } from './i18n-provider';

export function Leaderboard({ gameId, refreshKey = 0 }: { gameId: string; refreshKey?: number }) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(leaderboardConfigured ? 'loading' : 'error');

  useEffect(() => {
    if (!leaderboardConfigured) return;
    let active = true;
    void getLeaderboard(gameId)
      .then((result) => { if (active) { setEntries(result); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [gameId, refreshKey]);

  return <section className="leaderboard" aria-label={t('leaderboard.title')}>
    <header className="leaderboard-heading">
      <span className="leaderboard-mark"><Trophy size={22} /></span>
      <div><span className="leaderboard-eyebrow">{t('leaderboard.eyebrow')}</span><h2>{t('leaderboard.title')}</h2></div>
      <span className="leaderboard-live"><i />{t('leaderboard.live')}</span>
    </header>
    <div className="leaderboard-body">
      {state === 'loading' && <div className="leaderboard-skeleton" aria-label={t('leaderboard.loading')}>
        {[0, 1, 2].map((item) => <span key={item}><i /><b /><em /></span>)}
      </div>}
      {state === 'error' && <div className="leaderboard-message">
        <span><WifiOff size={22} /></span><div><b>{t('leaderboard.unavailable')}</b><p>{t('leaderboard.unavailableHint')}</p></div>
      </div>}
      {state === 'ready' && (entries.length
        ? <ol>{entries.map((entry) => <li className={entry.rank <= 3 ? `leaderboard-top rank-${entry.rank}` : ''} key={`${entry.player}-${entry.rank}`}>
          <span className="leaderboard-rank">{entry.rank <= 3 ? <Trophy size={14} /> : entry.rank}</span>
          <span className="leaderboard-player-avatar">{entry.player.trim().charAt(0).toUpperCase() || '?'}</span>
          <span className="leaderboard-player"><b>{entry.player}</b><small>{t('leaderboard.rank', { rank: entry.rank })}</small></span>
          <span className="leaderboard-score"><b>{entry.score.toLocaleString()}</b><small>{t('leaderboard.points')}</small></span>
        </li>)}</ol>
        : <div className="leaderboard-message leaderboard-empty">
          <span><Sparkles size={22} /></span><div><b>{t('leaderboard.empty')}</b><p>{t('leaderboard.emptyHint')}</p></div>
        </div>)}
    </div>
    <footer className="leaderboard-footer"><Sparkles size={13} />{t('leaderboard.footer')}</footer>
  </section>;
}
