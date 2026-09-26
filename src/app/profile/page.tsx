'use client';
import { ProfilePanel } from '@/components/profile';
import { useI18n } from '@/components/i18n-provider';
export default function Profile() {
  const { t } = useI18n();
  return (
    <div className="page my-dreamy-page">
      <div className="page-heading">
        <p className="eyebrow">{t('profile.eyebrow')}</p>
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.description')}</p>
      </div>
      <ProfilePanel />
    </div>
  );
}
