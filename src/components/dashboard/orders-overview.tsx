'use client';

import { ShoppingCart } from 'lucide-react';

interface OrdersOverviewProps {
  ordersByStatus: Record<string, number>;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: 'Confirmados', color: 'bg-blue-500' },
  PREPARING: { label: 'En preparación', color: 'bg-yellow-500' },
  DISPATCHED: { label: 'Despachados', color: 'bg-orange-500' },
  DELIVERED: { label: 'Entregados', color: 'bg-green-500' },
  CANCELLED: { label: 'Cancelados', color: 'bg-red-500' },
};

export function OrdersOverview({ ordersByStatus }: OrdersOverviewProps) {
  const total = Object.values(ordersByStatus).reduce((sum, n) => sum + n, 0);

  return (
    <div data-testid="dashboard-orders-overview">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingCart className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700">Pedidos ({total})</h3>
      </div>
      <div className="space-y-2">
        {Object.entries(statusLabels).map(([key, { label, color }]) => {
          const count = ordersByStatus[key] ?? 0;
          if (count === 0) return null;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-sm text-gray-600 flex-1">{label}</span>
              <span className="text-sm font-semibold text-gray-900">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
