'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { useI18n } from './i18n-provider';

export type SortOption<T extends string> = { value: T; label: string };

export function SortPicker<T extends string>({
  value,
  options,
  onChange,
  buttonLabel,
  disabled = false,
}: {
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
  buttonLabel?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const selected = options.find((option) => option.value === value);

  const close = useCallback(() => {
    if (!open || closing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(false);
      window.requestAnimationFrame(() => buttonRef.current?.focus());
      return;
    }
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimerRef.current = null;
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }, 160);
  }, [closing, open]);

  const openPicker = useCallback(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setClosing(false);
    setOpen(true);
  }, []);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, open]);

  return <>
    <button
      ref={buttonRef}
      type="button"
      className="button secondary compact sort-picker-trigger"
      disabled={disabled || !options.length}
      onClick={openPicker}
      aria-label={buttonLabel ?? t('common.sortBy')}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <SlidersHorizontal size={16} />
      {selected?.label}
    </button>
    {open && createPortal(<div className="sort-picker-backdrop" data-state={closing ? 'closing' : 'open'} role="presentation" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="sort-picker-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header><h2 id={titleId}>{t('common.sortBy')}</h2><button type="button" className="sort-picker-close" onClick={close} aria-label={t('common.closeSortOptions')}><X size={18} /></button></header>
        <fieldset>
          <legend className="sr-only">{t('common.sortBy')}</legend>
          {options.map((option) => <label key={option.value} className="sort-picker-option">
            <input type="radio" name={titleId} value={option.value} checked={value === option.value} onChange={() => { onChange(option.value); close(); }} />
            <span>{option.label}</span>
          </label>)}
        </fieldset>
      </section>
    </div>, document.body)}
  </>;
}
