'use client';

import { useEffect, useState } from 'react';
import { staffApi, type StockAlert } from '@/lib/api';
import { StockAlertCard } from '@/components/wms/stock-alert-card';

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    staffApi.getStockAlerts()
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6" data-testid="alertas-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Alertas de Stock</h1>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">Sin alertas</p>
          <p className="text-sm">Todos los SKUs están por encima de su umbral.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => <StockAlertCard key={`${alert.sku}-${alert.locationId}`} alert={alert} />)}
        </div>
      )}
    </div>
  );
}
