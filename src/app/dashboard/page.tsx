'use client';

import { useEffect, useState } from 'react';
import { DollarSign, ShoppingCart, Factory, AlertTriangle } from 'lucide-react';
import { backofficeApi, type DashboardStats, type StockAlert } from '@/lib/api';
import { StatsCard } from '@/components/dashboard/stats-card';
import { StockAlerts } from '@/components/dashboard/stock-alerts';
import { OrdersOverview } from '@/components/dashboard/orders-overview';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([backofficeApi.getDashboardStats(), backofficeApi.getStockAlerts()])
      .then(([s, a]) => {
        setStats(s);
        setAlerts(a);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-page">
        <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Ventas hoy"
          value={`S/ ${((stats?.todaySalesCents ?? 0) / 100).toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <StatsCard
          title="Pedidos hoy"
          value={String(stats?.todayOrderCount ?? 0)}
          icon={<ShoppingCart className="w-5 h-5" />}
          color="blue"
        />
        <StatsCard
          title="Producción hoy"
          value={`${(stats?.todayProductionKg ?? 0).toFixed(1)} kg`}
          subtitle={`Merma: ${(stats?.todayWasteKg ?? 0).toFixed(1)} kg`}
          icon={<Factory className="w-5 h-5" />}
          color="orange"
        />
        <StatsCard
          title="Alertas stock"
          value={String(alerts.length)}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Lower section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <OrdersOverview ordersByStatus={stats?.ordersByStatus ?? {}} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" /> Alertas de Stock
          </h3>
          <StockAlerts alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
