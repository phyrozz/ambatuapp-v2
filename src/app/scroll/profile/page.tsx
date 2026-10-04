'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CreatorProfile } from '@/components/creator-profile';
import { MemberGate } from '@/components/member-gate';
import { LoadingIndicator } from '@/components/loading-indicator';
import { useI18n } from '@/components/i18n-provider';
import { creatorHref } from '@/lib/creator-profile';

function ProfileRoute() {
  const params = useSearchParams();
  const id = params.get('user') ?? '';
  const { t } = useI18n();
  if (!/^[\w-]{1,128}$/.test(id) || id === 'admin')
    return (
      <div className="page creator-page">
        <p role="alert">{t('creator.loadError')}</p>
        <Link className="button secondary" href="/scroll/">
          {t('creator.back')}
        </Link>
      </div>
    );
  return (
    <MemberGate title="creator.title" returnTo={creatorHref(id)}>
      <div className="page creator-page">
        <CreatorProfile key={id} id={id} />
      </div>
    </MemberGate>
  );
}

export default function CreatorPage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="page">
          <LoadingIndicator label={t('profile.loading')} />
        </div>
      }
    >
      <ProfileRoute />
    </Suspense>
  );
}
