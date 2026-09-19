'use client';
import { WatchFeed } from '@/components/watch-feed';
import { useI18n } from '@/components/i18n-provider';
export default function Watch() {
  const { t } = useI18n();
  return (
    <div className="page watch-page">
      <div className="page-heading watch-page-heading">
        <p className="eyebrow">{t('watch.eyebrow')}</p>
        <h1>{t('watch.title')}</h1>
        <p>{t('watch.description')}</p>
      </div>
      <WatchFeed />
    </div>
  );
}
