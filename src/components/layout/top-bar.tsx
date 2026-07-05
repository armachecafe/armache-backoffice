'use client';

import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/contexts/permissions-context';
import { useRouter } from 'next/navigation';

export function TopBar() {
  const { user, logout } = useAuth();
  const { role } = usePermissions();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrador',
    MARKETING: 'Marketing',
    SUPPORT: 'Soporte',
    PLANT_OPERATOR: 'Operador Planta',
    WAREHOUSE_LEAD: 'Jefe Almacén',
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6" data-testid="backoffice-topbar">
      <div>
        <h2 className="text-sm font-medium text-gray-500">Panel de Administración</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Role badge */}
        {role && (
          <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-light text-brand-primary" data-testid="topbar-role-badge">
            {roleLabels[role] ?? role}
          </span>
        )}

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center text-xs font-medium">
            {user?.givenName?.[0]?.toUpperCase() ?? <User className="w-4 h-4" />}
          </div>
          <span className="hidden sm:block text-sm font-medium text-gray-700">
            {user?.givenName ?? user?.email}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-red-600 transition-colors"
          aria-label="Cerrar sesión"
          data-testid="topbar-logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
