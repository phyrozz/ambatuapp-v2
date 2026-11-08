'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ambatupost } from '@/components/ambatupost';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/components/i18n-provider';
import { LoadingIndicator } from '@/components/loading-indicator';

function DreamLoading() {
  const { t } = useI18n();
  return (
    <div className="page">
      <LoadingIndicator label={t('common.loading')} />
    </div>
  );
}
function Content() {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  const params = useSearchParams();
  const id = params.get('dream');
  if (process.env.NEXT_PUBLIC_AMBATUPOST_ENABLED !== 'true')
    return (
      <section className="page">
        <h1>{t('post.title')}</h1>
        <p>{t('post.disabled')}</p>
      </section>
    );
  if (!ready) return <DreamLoading />;
  return (
    <Ambatupost
      key={`${user?.id ?? 'guest'}:${id ?? 'new'}`}
      dreamId={id}
      cleanupId={params.get('cleanup')}
    />
  );
}
export default function AmbatupostPage() {
  return (
    <Suspense fallback={<DreamLoading />}>
      <Content />
    </Suspense>
  );
}
