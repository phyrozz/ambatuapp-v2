'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isMaintenanceAllowed } from '@/lib/maintenance-mode';

// Temporary maintenance mode: remove this wrapper and the matching head script to restore the site.
export function MaintenanceRedirect({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAllowed = isMaintenanceAllowed(pathname);

  useEffect(() => {
    if (!isAllowed) window.location.replace('/maintenance/');
  }, [isAllowed]);

  return isAllowed ? children : null;
}
