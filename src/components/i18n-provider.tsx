'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import en from '@/messages/en.json';
import id from '@/messages/id.json';

export type Locale = 'en' | 'id';
type Variables = Record<string, string | number>;
type Messages = Record<string, string>;

const dictionaries: Record<Locale, Messages> = { en, id };
const localeNames: Record<Locale, string> = { en: 'English', id: 'Bahasa Indonesia' };

type I18nContext = {
  locale: Locale;
  locales: readonly Locale[];
  localeNames: Record<Locale, string>;
  setLocale: (locale: Locale) => void;
  t: (key: string, variables?: Variables) => string;
};

const Context = createContext<I18nContext | null>(null);

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'id';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const selectionMade = useRef(false);

  // Resolve the preference after mount so static HTML stays deterministic.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = localStorage.getItem('ambatuapp-locale');
    if (isLocale(saved)) {
      setLocaleState(saved);
      return;
    }
    if (Capacitor.isNativePlatform()) {
      setLocaleState(navigator.language.toLowerCase().startsWith('id') ? 'id' : 'en');
      return;
    }
    let active = true;
    fetch('/locale-country.txt', { cache: 'no-store' })
      .then(response => {
        if (active && !selectionMade.current && response.ok) {
          setLocaleState(response.headers.get('x-ambatu-default-locale') === 'id' ? 'id' : 'en');
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContext>(() => ({
    locale,
    locales: ['en', 'id'],
    localeNames,
    setLocale(next) {
      selectionMade.current = true;
      setLocaleState(next);
      localStorage.setItem('ambatuapp-locale', next);
    },
    t(key, variables = {}) {
      const message = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
      return message.replace(/\{(\w+)\}/g, (_, name: string) => String(variables[name] ?? `{${name}}`));
    },
  }), [locale]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error('I18nProvider is required');
  return value;
}
