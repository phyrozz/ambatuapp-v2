export type Video = { title: string; url: string; thumbnail: string; channel: string };
export type Profile = {
  name: string;
  handle: string;
  bio: string;
  followers: number;
  following: number;
  image: string;
};
export function httpsUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}
export async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  if (!httpsUrl(url)) throw new Error('This feed needs a valid HTTPS address.');
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    credentials: 'omit',
  });
  if (!response.ok) throw new Error('The feed is unavailable right now. Please try again.');
  return response.json();
}
export function parseVideos(data: unknown): Video[] {
  if (!Array.isArray(data)) throw new Error('The video feed returned an unexpected format.');
  return data.flatMap((row: unknown) => {
    if (!row || typeof row !== 'object') return [];
    const v = row as Record<string, unknown>;
    const url = httpsUrl(v.url);
    if (!url || typeof v.title !== 'string') return [];
    return [
      {
        title: v.title,
        url,
        thumbnail: httpsUrl(v.thumbnail ?? v.thumbnailUrl),
        channel:
          typeof (v.channel ?? v.channelName) === 'string'
            ? String(v.channel ?? v.channelName)
            : 'Community video',
      },
    ];
  });
}
export function parseProfile(data: unknown): Profile {
  const item = Array.isArray(data) ? data[0] : data;
  if (!item || typeof item !== 'object')
    throw new Error('The profile feed returned an unexpected format.');
  const p = item as Record<string, unknown>;
  if (typeof (p.name ?? p.username) !== 'string')
    throw new Error('The profile feed is missing a name.');
  return {
    name: String(p.name ?? p.username),
    handle: String(p.handle ?? p.handleName ?? ''),
    bio: String(p.bio ?? p.description ?? ''),
    followers: Number(p.followers ?? p.followersCount) || 0,
    following: Number(p.following ?? p.friendsCount) || 0,
    image: httpsUrl(p.image ?? p.profileImage),
  };
}
