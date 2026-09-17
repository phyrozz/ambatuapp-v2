'use client';
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { getLeaderboard, leaderboardConfigured, type LeaderboardEntry } from '@/lib/leaderboard';

export function Leaderboard({ gameId }: { gameId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(leaderboardConfigured ? 'loading' : 'error');
  useEffect(() => {
    if (!leaderboardConfigured) return;
    let active = true;
    void getLeaderboard(gameId).then((result) => { if (active) { setEntries(result); setState('ready'); } }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [gameId]);
  return <section className="leaderboard panel" aria-label="Leaderboard">
    <div className="leaderboard-heading"><span><Trophy size={18} /> Leaderboard</span><small>Top players</small></div>
    {state === 'loading' && <p>Loading scores…</p>}
    {state === 'error' && <p>Leaderboard will be available once the score API is connected.</p>}
    {state === 'ready' && (entries.length ? <ol>{entries.map((entry) => <li key={`${entry.player}-${entry.rank}`}><span>#{entry.rank} {entry.player}</span><b>{entry.score.toLocaleString()}</b></li>)}</ol> : <p>No scores yet. Be the first on the board.</p>)}
  </section>;
}
