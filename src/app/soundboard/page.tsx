'use client';
import { SoundLibrary } from '@/components/sound-library';
import { useI18n } from '@/components/i18n-provider';
import { useApp } from '@/components/app-provider';
import { CommunityUpload } from '@/components/community-upload';
export default function Soundboard() {
  const { t } = useI18n();
  const { refreshSoundCatalog } = useApp();
  return (
    <div className="page soundboard-page">
      <div className="page-heading">
        <p className="eyebrow">{t('soundboard.eyebrow')}</p>
        <h1>{t('soundboard.title')}</h1>
        <p>{t('soundboard.dynamicDescription')}</p>
      </div>
      <CommunityUpload kind="sound" onPublished={refreshSoundCatalog} />
      <SoundLibrary />
    </div>
  );
}
