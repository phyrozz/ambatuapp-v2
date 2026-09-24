'use client';
import { useSearchParams } from 'next/navigation';
import { CommunityVideoPage } from './community-video-page';
import { LoreReader } from './lore-reader';
import { CharacterDetail } from './character-detail';

export function NativeDetail({ kind, id }: { kind: 'watch' | 'lores' | 'characters'; id: string }) {
  const params = useSearchParams();
  const resolvedId = id === 'native' ? params.get('id') ?? '' : id;
  if (!resolvedId) return null;
  if (kind === 'watch') return <CommunityVideoPage id={resolvedId} />;
  if (kind === 'lores') return <LoreReader id={resolvedId} />;
  return <CharacterDetail id={resolvedId} />;
}
