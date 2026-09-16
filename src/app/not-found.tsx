'use client';
import Link from 'next/link';
import { useI18n } from '@/components/i18n-provider';
export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="page empty-state">
      <p className="eyebrow">{t('notFound.eyebrow')}</p>
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.description')}</p>
      <Link className="button dark" href="/">
        {t('notFound.back')}
      </Link>
    </div>
  );
}
