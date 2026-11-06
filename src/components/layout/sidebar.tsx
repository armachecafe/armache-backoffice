'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, Warehouse, Factory, ChevronLeft, ChevronRight, ChevronDown, Package, BarChart3, RotateCcw, Search, Sprout, Wheat, Boxes, PackageCheck, ScanLine, Truck, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '@/contexts/permissions-context';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  group?: string;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
}

const navGroups: NavGroup[] = [
  { label: 'Finca', icon: Sprout },
  { label: 'Inventario', icon: Boxes },
  { label: 'Despacho', icon: Truck },
];

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'admin:dashboard:view' },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart, permission: 'order:list' },
  { href: '/catalogo', label: 'Catálogo', icon: Package, permission: 'catalog:product:list' },
  { href: '/almacen/recepciones', label: 'Recepciones', icon: Warehouse, permission: 'wms:reception:create' },
  { href: '/almacen/transferencias', label: 'Transferencias', icon: Warehouse, permission: 'wms:transfer:create' },
  { href: '/almacen/alertas', label: 'Alertas Stock', icon: Warehouse, permission: 'wms:alert:view' },
  { href: '/almacen/devoluciones', label: 'Devoluciones', icon: RotateCcw, permission: 'wms:return:create' },
  { href: '/finca/cosechas', label: 'Cosechas', icon: Wheat, group: 'Finca', permission: 'wms:harvest:read' },
  { href: '/inventario/ubicaciones', label: 'Ubicaciones', icon: Warehouse, group: 'Inventario', permission: 'location:manage' },
  { href: '/inventario/stock', label: 'Stock', icon: PackageCheck, group: 'Inventario', permission: 'inventory:view' },
  { href: '/inventario/conteos', label: 'Conteos', icon: ScanLine, group: 'Inventario', permission: 'inventory:count' },
  { href: '/inventario/traslados', label: 'Traslados', icon: Truck, group: 'Inventario', permission: 'inventory:transfer' },
  { href: '/despacho/asignacion', label: 'Asignación', icon: ClipboardList, group: 'Despacho', permission: 'order:assign' },
  { href: '/produccion', label: 'Producción', icon: Factory, permission: 'mes:order:create' },
  { href: '/produccion/historial', label: 'Historial MES', icon: Factory, permission: 'mes:order:view' },
  { href: '/trazabilidad', label: 'Trazabilidad', icon: Search, permission: 'traceability:lot:view' },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, permission: 'admin:reports:view' },
];

function NavLink({ item, activeHref, collapsed, nested }: { item: NavItem; activeHref: string | undefined; collapsed: boolean; nested?: boolean }) {
  const isActive = item.href === activeHref;
  const Icon = item.icon;
  return (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${nested ? 'ml-4' : ''} ${
        isActive ? 'bg-brand-light text-brand-primary' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
      title={collapsed ? item.label : undefined}
      data-testid={`sidebar-nav-${item.href.replace(/\//g, '-').slice(1)}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const rawPathname = usePathname();
  // Normalize trailing slash (next.config has trailingSlash: true for static export)
  const pathname = rawPathname !== '/' ? rawPathname.replace(/\/$/, '') : rawPathname;
  const { can } = usePermissions();

  const visibleItems = navItems.filter((item) => !item.permission || can(item.permission));

  // Active = the item whose href is the LONGEST match for the current path.
  // Prevents a parent (e.g. /produccion) from staying active on a child
  // route (/produccion/historial) that has its own nav item.
  const activeHref = visibleItems
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  const ungrouped = visibleItems.filter((item) => !item.group);
  const groups = navGroups
    .map((group) => ({ ...group, items: visibleItems.filter((item) => item.group === group.label) }))
    .filter((group) => group.items.length > 0);

  function isGroupOpen(label: string) {
    if (openGroups.includes(label)) return true;
    // Auto-open the group that owns the active page; never auto-close a manual toggle.
    return groups.find((g) => g.label === label)?.items.some((item) => item.href === activeHref) ?? false;
  }

  return (
    <aside
      className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
      data-testid="backoffice-sidebar"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-100">
        {!collapsed && (
          <span className="font-display text-lg text-brand-primary font-bold">Armache</span>
        )}
        {collapsed && <span className="font-display text-lg text-brand-primary font-bold">A</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {ungrouped.map((item) => (
          <NavLink key={item.href} item={item} activeHref={activeHref} collapsed={collapsed} />
        ))}
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const open = collapsed || isGroupOpen(group.label);
          return (
            <div key={group.label}>
              {!collapsed && (
                <button
                  onClick={() =>
                    setOpenGroups((prev) =>
                      prev.includes(group.label) ? prev.filter((l) => l !== group.label) : [...prev, group.label],
                    )
                  }
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  data-testid={`sidebar-group-${group.label.toLowerCase()}`}
                >
                  <GroupIcon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} />
                </button>
              )}
              {open &&
                group.items.map((item) => (
                  <NavLink key={item.href} item={item} activeHref={activeHref} collapsed={collapsed} nested={!collapsed} />
                ))}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-12 flex items-center justify-center border-t border-gray-100 text-gray-400 hover:text-gray-600"
        aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        data-testid="sidebar-toggle"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
