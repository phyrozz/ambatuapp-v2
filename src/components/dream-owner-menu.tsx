'use client';

import Link from 'next/link';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from './i18n-provider';

export function DreamOwnerMenu({
  editHref,
  onEdit,
  onDelete,
  editLabelKey = 'post.edit',
  deleteLabelKey = 'post.delete',
}: {
  editHref?: string;
  onEdit?: () => void;
  onDelete: () => void;
  editLabelKey?: string;
  deleteLabelKey?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="dream-owner-menu" ref={root}>
      <button
        ref={trigger}
        className="dream-owner-trigger"
        type="button"
        aria-label={t('chat.moreActions')}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={21} aria-hidden="true" />
      </button>
      <div
        id={menuId}
        className="dream-owner-options"
        data-open={open}
        aria-hidden={!open}
        inert={!open}
      >
        {editHref ? (
          <Link href={editHref} prefetch={false} onClick={() => setOpen(false)}>
            <Pencil size={16} aria-hidden="true" />
            {t(editLabelKey)}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit?.();
            }}
          >
            <Pencil size={16} aria-hidden="true" />
            {t(editLabelKey)}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            trigger.current?.focus();
            onDelete();
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          {t(deleteLabelKey)}
        </button>
      </div>
    </div>
  );
}
