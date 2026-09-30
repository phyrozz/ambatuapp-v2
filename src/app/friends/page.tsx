'use client';
import { MemberGate } from '@/components/member-gate';
import { Friends } from '@/components/friends';
import { useAuth } from '@/components/auth-provider';
export default function FriendsPage() {
  const { user } = useAuth();
  return <MemberGate title="friends.title" returnTo="/friends/"><Friends key={user?.id} /></MemberGate>;
}
