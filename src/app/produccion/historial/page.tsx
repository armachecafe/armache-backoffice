'use client';

import { useEffect, useState } from 'react';
import { staffApi, type ProductionOrder } from '@/lib/api';
import { ProductionHistoryTable } from '@/components/mes/production-history-table';

export default function HistorialPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processFilter, setProcessFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    staffApi.getProductionHistory({ process: processFilter || undefined, pageSize: 50 })
      .then((result) => setOrders(result.items))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [processFilter]);

  return (
    <div className="space-y-6" data-testid="historial-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-gray-900">Historial de Producción</h1>
        <select
          value={processFilter}
          onChange={(e) => setProcessFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          data-testid="historial-process-filter"
        >
          <option value="">Todos los procesos</option>
          <option value="ROASTING">Tostado</option>
          <option value="GRINDING">Molido</option>
          <option value="PACKAGING">Empacado</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <ProductionHistoryTable orders={orders} />
      )}
    </div>
  );
}
