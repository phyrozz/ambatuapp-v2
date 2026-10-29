'use client';
import { LoreFeed } from '@/components/lore-feed';
import { useI18n } from '@/components/i18n-provider';
export default function LoresPage() {
  const { t } = useI18n();
  return (
    <div className="page lore-page">
      <LoreFeed />
    </div>
  );
}
