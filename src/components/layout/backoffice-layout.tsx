'use client';

import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/contexts/permissions-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { MobileNav } from '@/components/layout/mobile-nav';

interface BackofficeLayoutProps {
  children: React.ReactNode;
}

export function BackofficeLayout({ children }: BackofficeLayoutProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { role, isLoading: permLoading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated && pathname !== '/login') {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, pathname, router]);

  // Skip layout for login page
  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isOperator = role === 'PLANT_OPERATOR';

  // Operator gets mobile-first layout
  if (isOperator) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <div className="flex">
          {/* Desktop: still show sidebar for operators on large screens */}
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen">
            <TopBar />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
        <MobileNav />
      </div>
    );
  }

  // Standard desktop layout for Admin, Soporte, Jefe Almacén
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
