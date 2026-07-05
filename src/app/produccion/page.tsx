'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { staffApi, type ProductionOrder } from '@/lib/api';
import { CloseOrderForm } from '@/components/mes/close-order-form';

export default function ProduccionPage() {
  const [inProgress, setInProgress] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingOrder, setClosingOrder] = useState<ProductionOrder | null>(null);

  function fetchOrders() {
    setLoading(true);
    staffApi.listProductionOrders({ status: 'IN_PROGRESS' })
      .then(setInProgress)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchOrders(); }, []);

  const processLabels: Record<string, string> = { ROASTING: 'Tostado', GRINDING: 'Molido', PACKAGING: 'Empacado' };

  return (
    <div className="space-y-6" data-testid="produccion-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-gray-900">Producción</h1>
        <Link
          href="/produccion/nueva"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 text-sm"
          data-testid="produccion-nueva-button"
        >
          <Plus className="w-4 h-4" /> Nueva Orden
        </Link>
      </div>

      {/* Closing modal */}
      {closingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Cerrar Orden</h2>
            <CloseOrderForm
              order={closingOrder}
              onSuccess={() => { setClosingOrder(null); fetchOrders(); }}
              onCancel={() => setClosingOrder(null)}
            />
          </div>
        </div>
      )}

      {/* In-progress orders */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Órdenes en proceso</h2>
        {loading ? (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : inProgress.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Sin órdenes en proceso</div>
        ) : (
          <div className="space-y-3">
            {inProgress.map((order) => (
              <div key={order.orderId} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg" data-testid={`production-order-${order.orderId}`}>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{processLabels[order.process]}</p>
                  <p className="text-sm text-gray-500">{order.inputSku} · Lote: {order.inputLotCode} · {order.inputQtyKg} kg</p>
                  <p className="text-xs text-gray-400">Inicio: {new Date(order.startedAt).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <button
                  onClick={() => setClosingOrder(order)}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                  data-testid={`close-order-button-${order.orderId}`}
                >
                  Cerrar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
