'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import styles from './custom-checkbox.module.css';

type CustomCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
};

export function CustomCheckbox({ checked, onChange, children }: CustomCheckboxProps) {
  return (
    <label className={styles.checkbox}>
      <input
        className={styles.input}
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
      />
      <span className={styles.indicator} aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
      <span className={styles.label}>{children}</span>
    </label>
  );
}
