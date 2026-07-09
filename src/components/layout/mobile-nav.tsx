'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Factory, Clock, User } from 'lucide-react';

const mobileNavItems = [
  { href: '/produccion', label: 'Producción', icon: Factory },
  { href: '/produccion/historial', label: 'Historial', icon: Clock },
  { href: '/login', label: 'Perfil', icon: User },
];

export function MobileNav() {
  const rawPathname = usePathname();
  const pathname = rawPathname !== '/' ? rawPathname.replace(/\/$/, '') : rawPathname;

  // Active = longest matching href (prevents /produccion staying active on /produccion/historial)
  const activeHref = mobileNavItems
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb" data-testid="mobile-nav">
      <div className="flex items-center justify-around h-16">
        {mobileNavItems.map((item) => {
          const isActive = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${
                isActive ? 'text-brand-primary' : 'text-gray-400'
              }`}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
