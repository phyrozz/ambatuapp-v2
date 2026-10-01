'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from './i18n-provider';
import './friends.css';

export function FriendsDialog({
  title,
  description,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const heading = useId();
  const help = useId();
  const pane = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const action = useRef({ onClose, busy });
  useEffect(() => {
    action.current = { onClose, busy };
  }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!action.current.busy) action.current.onClose();
      }
      if (event.key !== 'Tab' || !pane.current) return;
      const controls = [
        ...pane.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]',
        ),
      ].filter((item) => item.getClientRects().length > 0);
      const first = controls[0],
        last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        pane.current.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || !pane.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !pane.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return typeof document === 'undefined'
    ? null
    : createPortal(
        <div
          className="friends-dialog-backdrop"
          onPointerDown={(event) => {
            if (!busy && event.target === event.currentTarget) onClose();
          }}
        >
          <section
            ref={pane}
            className="friends-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={heading}
            aria-describedby={description ? help : undefined}
            tabIndex={-1}
            aria-busy={busy}
          >
            <header>
              <div>
                <span className="eyebrow">{t('friends.eyebrow')}</span>
                <h2 id={heading}>{title}</h2>
              </div>
              <button
                ref={close}
                className="friends-icon-button"
                type="button"
                disabled={busy}
                onClick={onClose}
                aria-label={t('chat.dismiss')}
              >
                <X size={20} />
              </button>
            </header>
            {description && (
              <p id={help} className="friends-dialog-help">
                {description}
              </p>
            )}
            {children}
          </section>
        </div>,
        document.body,
      );
}
