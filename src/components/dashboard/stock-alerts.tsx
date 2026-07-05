'use client';

import { AlertTriangle } from 'lucide-react';
import type { StockAlert } from '@/lib/api';

interface StockAlertsProps {
  alerts: StockAlert[];
}

export function StockAlerts({ alerts }: StockAlertsProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        Sin alertas de stock
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="dashboard-stock-alerts">
      {alerts.slice(0, 5).map((alert) => (
        <div key={`${alert.sku}-${alert.locationId}`} className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{alert.productName}</p>
            <p className="text-xs text-gray-500">{alert.locationName} · Stock: {alert.currentStock} (umbral: {alert.threshold})</p>
          </div>
        </div>
      ))}
      {alerts.length > 5 && (
        <p className="text-xs text-gray-400 text-center">+{alerts.length - 5} alertas más</p>
      )}
    </div>
  );
}
