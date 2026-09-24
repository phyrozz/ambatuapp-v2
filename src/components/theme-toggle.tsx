'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from './i18n-provider';

type Theme = 'light' | 'dark';
const storageKey = 'ambatuapp-theme';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171815' : '#f8f7f2');
}

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const initial = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const label = t(nextTheme === 'dark' ? 'theme.useDark' : 'theme.useLight');

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        setTheme(nextTheme);
        localStorage.setItem(storageKey, nextTheme);
        applyTheme(nextTheme);
      }}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
