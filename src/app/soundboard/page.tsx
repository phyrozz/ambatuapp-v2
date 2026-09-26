'use client';
import { SoundLibrary } from '@/components/sound-library';
import { useI18n } from '@/components/i18n-provider';
export default function Soundboard() {
  const { t } = useI18n();
  return (
    <div className="page soundboard-page">
      <div className="page-heading">
        <p className="eyebrow">{t('soundboard.eyebrow')}</p>
        <h1>{t('soundboard.title')}</h1>
        <p>{t('soundboard.dynamicDescription')}</p>
      </div>
      <SoundLibrary />
    </div>
  );
}
