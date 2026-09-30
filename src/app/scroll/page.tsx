'use client';
import { MemberGate } from '@/components/member-gate';
import { Ambatuscroll } from '@/components/ambatuscroll';
import { useAuth } from '@/components/auth-provider';
export default function ScrollPage() {
  const { user } = useAuth();
  return <MemberGate title="nav.scroll" returnTo="/scroll/"><Ambatuscroll key={user?.id} /></MemberGate>;
}
