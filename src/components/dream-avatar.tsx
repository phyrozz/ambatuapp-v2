'use client';
import { UserRound } from 'lucide-react';
import { useState } from 'react';
export function DreamAvatar({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState('');
  return (
    <span className="dream-author-mark" aria-hidden="true">
      {src && failed !== src ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
      ) : name ? (
        name.slice(0, 1).toLocaleUpperCase()
      ) : (
        <UserRound size={21} />
      )}
    </span>
  );
}
