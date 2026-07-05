'use client';

import type { ProductionOrder } from '@/lib/api';

interface ProductionHistoryTableProps {
  orders: ProductionOrder[];
}

const processLabels: Record<string, string> = { ROASTING: 'Tostado', GRINDING: 'Molido', PACKAGING: 'Empacado' };

export function ProductionHistoryTable({ orders }: ProductionHistoryTableProps) {
  if (orders.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-sm">Sin órdenes de producción</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto" data-testid="production-history-table">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Proceso</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Insumo</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Lote</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Ingresado</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Producido</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Merma</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Operador</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 hidden lg:table-cell">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => (
            <tr key={order.orderId} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{processLabels[order.process] ?? order.process}</td>
              <td className="px-4 py-3 text-gray-600">{order.inputSku}</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden sm:table-cell">{order.inputLotCode}</td>
              <td className="px-4 py-3 text-right">{order.inputQtyKg} kg</td>
              <td className="px-4 py-3 text-right font-medium text-green-700">{order.outputQtyKg ?? '—'} kg</td>
              <td className="px-4 py-3 text-right text-red-600">{order.wasteKg ?? '—'} kg</td>
              <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{order.operator}</td>
              <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                {order.closedAt ? new Date(order.closedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : 'En proceso'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
