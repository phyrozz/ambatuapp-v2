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

export function creatorSearchIsReady(value: string) {
  const q = value.normalize('NFKC').trim();
  return q.includes('@')
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q) && q.length <= 254
    : q.length >= 2 && q.length <= 24;
}
