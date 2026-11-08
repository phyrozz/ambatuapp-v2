'use client';

import dynamic from 'next/dynamic';
import type { Dream } from '@/lib/ambatupost';
import { useI18n } from './i18n-provider';
import { FriendsDialog } from './friends-dialog';
import { DreamSkeleton } from './dream-skeleton';

const DreamEditor = dynamic(() => import('./ambatupost').then((module) => module.Ambatupost), {
  ssr: false,
  loading: () => <DreamSkeleton variant="editor" />,
});

export function DreamEditorDialog({ id, onClose, onSaved }: {
  id: string;
  onClose: () => void;
  onSaved: (dream: Dream) => void;
}) {
  const { t } = useI18n();
  return (
    <FriendsDialog title={t('post.edit')} onClose={onClose} className="dream-editor-dialog">
      <DreamEditor dreamId={id} editRequested editorOnly onEditorCancel={onClose} onEditorSaved={onSaved} />
    </FriendsDialog>
  );
}
