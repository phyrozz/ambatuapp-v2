export type CreatorProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
  joinedAt: string | null;
  followerCount: number;
  friendCount: number;
  clipCount: number;
  following: boolean;
  friendState: 'accepted' | 'incoming' | 'outgoing' | null;
};

export type CreatorClip = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  status: 'Draft' | 'Published';
  playable: boolean;
  createdAt: string | null;
  upvotes: number;
  commentCount: number;
};

export const creatorHref = (id: string) => `/scroll/profile/?user=${encodeURIComponent(id)}`;

export class CreatorReadError extends Error {
  constructor(readonly status: number) {
    super('PROFILE_UNAVAILABLE');
  }
}

export async function creatorRead<T>(
  path: string,
  token: string | null,
  signal?: AbortSignal,
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '');
  if (!base) throw new Error('PROFILE_UNAVAILABLE');
  const response = await fetch(`${base}${path}`, {
    cache: 'no-store',
    signal,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new CreatorReadError(response.status);
  return response.json() as Promise<T>;
}

export function creatorSearchIsReady(value: string) {
  const q = value.normalize('NFKC').trim();
  return q.includes('@')
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q) && q.length <= 254
    : q.length >= 2 && q.length <= 24;
}
