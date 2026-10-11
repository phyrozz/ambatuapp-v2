'use client';
import { LoreFeed } from '@/components/lore-feed';
import { useI18n } from '@/components/i18n-provider';
import { useState } from 'react';
import { CommunityUpload } from '@/components/community-upload';
export default function LoresPage() {
  const { t } = useI18n();
  const [revision, setRevision] = useState(0);
  return (
    <div className="page lore-page">
      <div className="page-heading">
        <p className="eyebrow">{t('lore.eyebrow')}</p>
        <h1>{t('lore.title')}</h1>
        <p>{t('lore.description')}</p>
      </div>
      <CommunityUpload kind="lore" onPublished={() => setRevision((value) => value + 1)} />
      <LoreFeed key={revision} />
    </div>
  );
}
