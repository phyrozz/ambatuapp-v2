'use client';

import { Bell, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { enableWebPushFromPrompt } from '@/lib/push-notifications';
import './push-permission-prompt.css';

export function PushPermissionPrompt() {
  const path = usePathname();
  const { ready, user, getAccessToken } = useAuth();
  const { locale, t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect -- sync prompt visibility with browser permission and session storage. */
  useEffect(() => {
    if (!ready || !user || Capacitor.isNativePlatform() || (path !== '/chat' && path !== '/chat/' && path !== '/profile' && path !== '/profile/')) {
      setVisible(false);
      return;
    }
    if (!('Notification' in window) || Notification.permission === 'denied') {
      setVisible(false);
      return;
    }
    const userKey = `ambatuapp-push-enabled:${user.id}`;
    const dismissedKey = `ambatuapp-push-prompt-dismissed:${user.id}`;
    if (Notification.permission === 'granted' && localStorage.getItem(userKey) === '1') {
      setVisible(false);
      return;
    }
    if (sessionStorage.getItem(dismissedKey) === '1') {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [path, ready, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function dismiss() {
    if (user) sessionStorage.setItem(`ambatuapp-push-prompt-dismissed:${user.id}`, '1');
    setVisible(false);
    setError('');
  }

  async function enable() {
    if (!user || busy) return;
    setBusy(true);
    setError('');
    try {
      await enableWebPushFromPrompt(locale, user.id, getAccessToken);
      sessionStorage.setItem(`ambatuapp-push-prompt-dismissed:${user.id}`, '1');
      setVisible(false);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'not-configured' ? t('chat.notificationsNotConfigured') : t('chat.pushError'));
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  return (
    <aside className="push-permission-prompt" aria-labelledby="push-permission-title">
      <button type="button" className="push-permission-close" onClick={dismiss} aria-label={t('chat.dismiss')}><X size={17}/></button>
      <span className="push-permission-icon"><Bell size={19}/></span>
      <h2 id="push-permission-title">{t('chat.enableNotifications')}</h2>
      <p>{t('push.promptDescription')}</p>
      {error && <p className="push-permission-error" role="alert">{error}</p>}
      <div className="push-permission-actions">
        <button type="button" className="button dark compact" disabled={busy} onClick={() => void enable()}>{t('chat.enableNotifications')}</button>
        <button type="button" className="push-permission-later" disabled={busy} onClick={dismiss}>{t('push.notNow')}</button>
      </div>
    </aside>
  );
}
