export type LeaderboardEntry = { rank: number; player: string; avatarUrl?: string | null; score: number; updatedAt: string | null };
const endpoint = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '');
export const leaderboardConfigured = Boolean(endpoint);

export async function getLeaderboard(gameId: string) {
  if (!endpoint) return [] as LeaderboardEntry[];
  const response = await fetch(`${endpoint}/leaderboards/${encodeURIComponent(gameId)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load the leaderboard.');
  return ((await response.json()) as { entries?: LeaderboardEntry[] }).entries ?? [];
}

export async function submitLeaderboardScore(gameId: string, score: number, accessToken: string | null) {
  if (!endpoint || !accessToken) return;
  const response = await fetch(`${endpoint}/leaderboards/${encodeURIComponent(gameId)}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ score }),
  });
  if (!response.ok) throw new Error('Could not submit your score.');
}
