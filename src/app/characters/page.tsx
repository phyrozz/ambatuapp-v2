'use client';
import { CharacterLibrary } from '@/components/character-library';
import { useI18n } from '@/components/i18n-provider';
export default function Characters() {
  const { t } = useI18n();
  return (
    <div className="page characters-page">
      <div className="page-heading">
        <p className="eyebrow">{t('characters.eyebrow')}</p>
        <h1>{t('characters.title')}</h1>
        <p>{t('characters.description')}</p>
      </div>
      <CharacterLibrary />
    </div>
  );
}
