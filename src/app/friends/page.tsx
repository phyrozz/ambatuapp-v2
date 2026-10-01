'use client';
import { MemberGate } from '@/components/member-gate';
import { Friends } from '@/components/friends';
import { useAuth } from '@/components/auth-provider';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
function FriendsContent() {
  const { user } = useAuth();
  const params = useSearchParams();
  return (
    <MemberGate
      title="friends.title"
      returnTo={`/friends/${params.toString() ? `?${params.toString()}` : ''}`}
    >
      <Friends key={user?.id} />
    </MemberGate>
  );
}
export default function FriendsPage() {
  return (
    <Suspense>
      <FriendsContent />
    </Suspense>
  );
}
