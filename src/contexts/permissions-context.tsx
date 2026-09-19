'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { backofficeApi } from '@/lib/api';

interface PermissionsContextValue {
  role: string;
  permissions: string[];
  isLoading: boolean;
  can: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setRole('');
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    backofficeApi
      .getMyPermissions()
      .then((data) => {
        setRole(data.role);
        setPermissions(data.permissions);
      })
      .catch(() => {
        // Fallback: use role from token
        setRole(user?.role ?? '');
        setPermissions([]);
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, user]);

  function can(permission: string): boolean {
    if (role === 'ADMIN') return true; // Admin has all permissions
    return permissions.includes(permission);
  }

  function hasRole(r: string): boolean {
    return role === r;
  }

  return (
    <PermissionsContext.Provider value={{ role, permissions, isLoading, can, hasRole }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
}
