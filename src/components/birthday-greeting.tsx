'use client';
import { useEffect, useState } from 'react';
import { Cake, X } from 'lucide-react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { getPlayerProfile } from '@/lib/player-profile';

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function BirthdayGreeting() {
  const { user, getIdToken } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState('');
  useEffect(() => {
    if (!user) return;
    const today = localDate(), seenKey = `ambatuapp-birthday-greeting:${user.id}:${today}`;
    if (localStorage.getItem(seenKey)) return;
    void getIdToken().then((token) => token ? getPlayerProfile(token) : null).then((profile) => {
      if (profile?.birthDate?.slice(5) === today.slice(5)) {
        localStorage.setItem(seenKey, '1');
        setName(profile.username);
      }
    }).catch(() => {});
  }, [getIdToken, user]);
  if (!name) return null;
  return <aside className="birthday-greeting" role="status"><Cake size={22}/><div><b>{t('profile.birthdayTitle', { name })}</b><span>{t('profile.birthdayBody')}</span></div><button onClick={() => setName('')} aria-label={t('profile.birthdayClose')}><X size={17}/></button></aside>;
}
