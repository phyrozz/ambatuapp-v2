export type PlayerProfile = { username: string; birthDate: string | null };

const endpoint = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '');

async function request(token: string, init?: RequestInit) {
  if (!endpoint) throw new Error('Player profile service is not configured.');
  const response = await fetch(`${endpoint}/profile`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init?.headers },
    cache: 'no-store',
  });
  const data = await response.json() as PlayerProfile & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Could not update profile.');
  return data as PlayerProfile;
}

export function getPlayerProfile(token: string) { return request(token); }
export function savePlayerProfile(token: string, profile: PlayerProfile) {
  return request(token, { method: 'PUT', body: JSON.stringify(profile) });
}
