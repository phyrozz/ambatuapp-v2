'use client';
import { Globe2, LockKeyhole, UsersRound } from 'lucide-react';
import type { DreamAudience } from '@/lib/ambatupost';
import { useI18n } from './i18n-provider';
export function DreamAudienceLabel({ audience }: { audience: DreamAudience }) {
  const { t } = useI18n();
  const Icon = { public: Globe2, friends: UsersRound, only_me: LockKeyhole }[audience];
  const key = { public: 'post.public', friends: 'post.friends', only_me: 'post.onlyMe' }[audience];
  return (
    <span className="dream-audience">
      <Icon size={14} aria-hidden="true" />
      {t(key)}
    </span>
  );
}
