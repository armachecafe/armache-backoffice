'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/contexts/permissions-context';
import { useAuth } from '@/contexts/auth-context';

export default function RootPage() {
  const { isAuthenticated } = useAuth();
  const { role } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    // Redirect based on role
    if (role === 'PLANT_OPERATOR') {
      router.replace('/produccion');
    } else {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, role, router]);

  return null;
}
