'use client';

import { BookOpen, Check, ChevronDown, Globe2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export type SelectOption = { value: string; label: string; icon?: 'gb' | 'id' | 'world' | 'book' };

export function languageFlag(locale: string): SelectOption['icon'] {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return ({ en: 'gb', id: 'id' } as Record<string, SelectOption['icon']>)[language] ?? 'world';
}

function OptionIcon({ icon }: { icon?: SelectOption['icon'] }) {
  if (!icon) return null;
  if (icon === 'world') return <Globe2 className="app-select-symbol" size={16} aria-hidden="true" />;
  if (icon === 'book') return <BookOpen className="app-select-symbol" size={16} aria-hidden="true" />;
  if (icon === 'id') return <svg className="app-select-flag" viewBox="0 0 24 16" aria-hidden="true"><path fill="#e70011" d="M0 0h24v8H0z"/><path fill="#fff" d="M0 8h24v8H0z"/></svg>;
  return <svg className="app-select-flag" viewBox="0 0 60 40" aria-hidden="true">
    <path fill="#012169" d="M0 0h60v40H0z"/><path stroke="#fff" strokeWidth="8" d="m0 0 60 40M60 0 0 40"/>
    <path stroke="#c8102e" strokeWidth="4" d="m0 0 60 40M60 0 0 40"/><path stroke="#fff" strokeWidth="13" d="M30 0v40M0 20h60"/>
    <path stroke="#c8102e" strokeWidth="7" d="M30 0v40M0 20h60"/>
  </svg>;
}

export function AppSelect({ value, options, onChange, ariaLabel, disabled = false }: {
  value: string; options: SelectOption[]; onChange: (value: string) => void;
  ariaLabel: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const choose = (index: number) => {
    if (!options[index]) return;
    onChange(options[index].value);
    setOpen(false);
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') return setOpen(false);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActive(((open ? active : selectedIndex) + direction + options.length) % options.length);
      setOpen(true);
    } else if (open && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      choose(active);
    }
  };

  return <div className={`app-select ${open ? 'open' : ''}`} ref={root}>
    <button type="button" className="app-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox"
      aria-expanded={open} aria-controls={listId} disabled={disabled} onKeyDown={keyDown}
      onClick={() => { setActive(selectedIndex); setOpen((current) => !current); }}>
      <span className="app-select-value"><OptionIcon icon={selected?.icon}/><span className="app-select-label">{selected?.label}</span></span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <div className="app-select-menu" id={listId} role="listbox" aria-label={ariaLabel}>
      {options.map((option, index) => <button type="button" role="option" aria-selected={option.value === value}
        className={`${index === active ? 'active' : ''} ${option.value === value ? 'selected' : ''}`}
        key={option.value} onPointerEnter={() => setActive(index)} onClick={() => choose(index)}>
        <span className="app-select-value"><OptionIcon icon={option.icon}/><span className="app-select-label">{option.label}</span></span>{option.value === value && <Check size={14} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
