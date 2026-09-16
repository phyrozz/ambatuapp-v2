'use client';
import { SoundLibrary } from '@/components/sound-library';
import { useI18n } from '@/components/i18n-provider';
export default function Favorites() {
  const { t } = useI18n();
  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">{t('favorites.eyebrow')}</p>
        <h1>{t('favorites.title')}</h1>
        <p>{t('favorites.description')}</p>
      </div>
      <SoundLibrary favoritesOnly />
    </div>
  );
}
