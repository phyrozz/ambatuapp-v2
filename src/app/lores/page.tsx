'use client';
import { LoreFeed } from '@/components/lore-feed';
import { useI18n } from '@/components/i18n-provider';
export default function LoresPage() { const { t } = useI18n(); return <div className="page lore-page"><div className="page-heading"><p className="eyebrow">{t('lore.eyebrow')}</p><h1>{t('lore.title')}</h1><p>{t('lore.description')}</p></div><LoreFeed /></div>; }
