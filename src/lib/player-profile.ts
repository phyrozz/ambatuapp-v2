export type PlayerProfile = { username: string; birthDate: string | null; avatarType?: 'preset' | 'custom' | null; avatarId?: string | null; avatarUrl?: string | null; avatarRemoved?: boolean };
export type ProfileAvatar = { id: string; name: string; imageUrl: string | null };

export class PlayerProfileError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

const endpoint = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '');

async function request(token: string, init?: RequestInit) {
  if (!endpoint) throw new Error('Player profile service is not configured.');
  const response = await fetch(`${endpoint}/profile`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init?.headers },
    cache: 'no-store',
  });
  const data = await response.json() as PlayerProfile & { error?: string; code?: string };
  if (!response.ok) throw new PlayerProfileError(data.error || 'Could not update profile.', data.code);
  return data as PlayerProfile;
}

export function getPlayerProfile(token: string) { return request(token); }
export async function initializePlayerProfile(token: string, signal?: AbortSignal): Promise<PlayerProfile> {
  if (!endpoint) throw new Error('Player profile service is not configured.');
  const response = await fetch(`${endpoint}/profile/initialize`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal,
  });
  const data = await response.json() as PlayerProfile & { error?: string };
  if (!response.ok) throw new PlayerProfileError(data.error || 'Could not update profile.');
  return data;
}
export function savePlayerProfile(token: string, profile: PlayerProfile) {
  return request(token, { method: 'PUT', body: JSON.stringify({ username: profile.username, birthDate: profile.birthDate }) });
}

export async function getProfileAvatars(token: string): Promise<ProfileAvatar[]> {
  if (!endpoint) throw new Error('Player profile service is not configured.');
  const response = await fetch(`${endpoint}/profile/avatars`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  const data = await response.json() as { avatars?: ProfileAvatar[] };
  if (!response.ok) throw new PlayerProfileError('Could not load profile avatars.');
  return data.avatars ?? [];
}

export async function saveProfileAvatar(token: string, avatarId: string | null) {
  if (!endpoint) throw new Error('Player profile service is not configured.');
  const response = await fetch(`${endpoint}/profile/avatar`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ avatarId }), cache: 'no-store' });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new PlayerProfileError(data.error || 'Could not save profile avatar.');
}

export async function submitCustomProfileAvatar(token: string, image: Blob) {
  if (!endpoint) throw new Error('Player profile service is not configured.');
  const form = new FormData();
  form.append('image', image, 'profile.jpg');
  const response = await fetch(`${endpoint}/profile/avatar/custom`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form, cache: 'no-store' });
  const data = await response.json() as { error?: string; avatarUrl?: string | null };
  if (!response.ok) throw new PlayerProfileError(data.error || 'Could not submit profile image.');
  return data.avatarUrl ?? null;
}
