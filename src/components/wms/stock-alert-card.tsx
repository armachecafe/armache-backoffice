'use client';

import { AlertTriangle } from 'lucide-react';
import type { StockAlert } from '@/lib/api';

interface StockAlertCardProps {
  alert: StockAlert;
}

export function StockAlertCard({ alert }: StockAlertCardProps) {
  const deficit = alert.threshold - alert.currentStock;

  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-yellow-200 rounded-lg" data-testid={`stock-alert-${alert.sku}`}>
      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{alert.productName}</p>
        <p className="text-sm text-gray-500">{alert.locationName}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-lg font-bold text-red-600">{alert.currentStock}</p>
        <p className="text-xs text-gray-400">umbral: {alert.threshold} (faltan {deficit})</p>
      </div>
    </div>
  );
}
