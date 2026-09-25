'use client';
import { useSearchParams } from 'next/navigation';
import { CommunityVideoPage } from './community-video-page';
import { LoreReader } from './lore-reader';
import { CharacterDetail } from './character-detail';
import { LoadingIndicator } from './loading-indicator';
import { useI18n } from './i18n-provider';

export function NativeDetailLoading({ kind }: { kind: 'watch' | 'lores' }) {
  const { t } = useI18n();
  return <div className="page"><div className="module-loading"><LoadingIndicator label={t(kind === 'watch' ? 'watch.openingVideo' : 'lore.opening')} /></div></div>;
}

export function NativeDetail({ kind, id }: { kind: 'watch' | 'lores' | 'characters'; id: string }) {
  const params = useSearchParams();
  const resolvedId = id === 'native' ? params.get('id') ?? '' : id;
  if (!resolvedId) return null;
  if (kind === 'watch') return <CommunityVideoPage id={resolvedId} />;
  if (kind === 'lores') return <LoreReader id={resolvedId} />;
  return <CharacterDetail id={resolvedId} />;
}
