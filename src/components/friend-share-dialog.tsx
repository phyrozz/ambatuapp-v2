'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Check, LogIn, MessageCircle } from 'lucide-react';
import { ChatSocket } from '@/lib/chat';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { FriendPickerDialog } from './friend-picker-dialog';
import { FriendsDialog } from './friends-dialog';
import type { Friend } from './use-friends';
import { LoadingIndicator } from './loading-indicator';

export function FriendShareDialog({
  kind,
  title,
  message,
  onClose,
}: {
  kind: 'game' | 'clip';
  title: string;
  message: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { ready, user, configured, getAccessToken, signInWithGoogle } = useAuth();
  const sent = useRef(new Map<string, string>());
  const [sentCount, setSentCount] = useState(0);
  const [firstConversation, setFirstConversation] = useState('');
  const [signInError, setSignInError] = useState(false);
  async function send(friends: Friend[]) {
    const url = process.env.NEXT_PUBLIC_CHAT_WS_URL;
    const token = await getAccessToken();
    if (!url || !token || !user) throw new Error('CHAT_UNAVAILABLE');
    const client = new ChatSocket();
    try {
      await client.connect(url, token);
      for (const friend of friends) {
        // Successful recipients are kept across retries so they don't get duplicate messages.
        if (sent.current.has(friend.id)) continue;
        const result = await client.request('createConversation', {
          members: [friend.id],
          names: { [friend.id]: friend.username, [user.id]: user.name },
        });
        const conversation = String(result.conversation);
        await client.request('send', { conversation, kind: 'text', text: message });
        sent.current.set(friend.id, conversation);
      }
      setSentCount(sent.current.size);
      setFirstConversation([...sent.current.values()][0]);
    } finally {
      client.close();
    }
  }
  if (!ready || !user)
    return (
      <FriendsDialog
        title={t(kind === 'game' ? 'friends.inviteGame' : 'friends.shareClip')}
        description={t('social.signIn')}
        onClose={onClose}
      >
        {!ready ? (
          <LoadingIndicator label={t('common.loading')} />
        ) : (
          <button
            type="button"
            className="button dark"
            disabled={!configured}
            onClick={() => {
              setSignInError(false);
              void signInWithGoogle(`${window.location.pathname}${window.location.search}`).catch(
                () => setSignInError(true),
              );
            }}
          >
            <LogIn size={17} />
            {t('profile.googleSignIn')}
          </button>
        )}
        {signInError && (
          <p className="friends-error" role="alert">
            {t('social.error')}
          </p>
        )}
      </FriendsDialog>
    );
  return sentCount ? (
    <FriendsDialog
      title={t(sentCount === 1 ? 'friends.sharedOne' : 'friends.shared', { count: sentCount })}
      description={title}
      onClose={onClose}
    >
      <div className="friends-share-success" aria-hidden="true">
        <Check size={32} />
      </div>
      <footer className="friends-dialog-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          {t('friends.done')}
        </button>
        <Link
          className="button dark"
          href={`/chat/?conversation=${encodeURIComponent(firstConversation)}`}
          onClick={onClose}
        >
          <MessageCircle size={17} />
          {t('friends.openChat')}
        </Link>
      </footer>
    </FriendsDialog>
  ) : (
    <FriendPickerDialog
      title={t(kind === 'game' ? 'friends.inviteGame' : 'friends.shareClip')}
      description={`${title} — ${t(kind === 'game' ? 'friends.gameInviteHint' : 'friends.clipShareHint')}`}
      confirmLabel={t('friends.send')}
      errorKey="friends.shareError"
      onConfirm={send}
      onClose={onClose}
    />
  );
}
