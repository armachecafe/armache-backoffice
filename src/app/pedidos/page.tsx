'use client';

import { useEffect, useState, useCallback } from 'react';
import { backofficeApi, type BackofficeOrderSummary } from '@/lib/api';
import { OrderTable } from '@/components/orders/order-table';

export default function PedidosPage() {
  const [orders, setOrders] = useState<BackofficeOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async (filters?: { status?: string; search?: string }) => {
    setLoading(true);
    try {
      const result = await backofficeApi.listOrders({ ...filters, pageSize: 50 });
      setOrders(result.items);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="space-y-4" data-testid="pedidos-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Pedidos</h1>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <OrderTable orders={orders} onFilterChange={fetchOrders} />
      )}
    </div>
  );
}
