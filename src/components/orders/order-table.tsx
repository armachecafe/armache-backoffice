'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdminOrderSummary, OrderStatus } from '@/lib/api';

interface OrderTableProps {
  orders: AdminOrderSummary[];
  onFilterChange: (filters: { status?: string; search?: string }) => void;
}

const statusOptions: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'CONFIRMED', label: 'Confirmados' },
  { value: 'PREPARING', label: 'En preparación' },
  { value: 'DISPATCHED', label: 'Despachados' },
  { value: 'DELIVERED', label: 'Entregados' },
  { value: 'CANCELLED', label: 'Cancelados' },
];

const statusColors: Record<OrderStatus, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-yellow-100 text-yellow-800',
  DISPATCHED: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function OrderTable({ orders, onFilterChange }: OrderTableProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    onFilterChange({ status: status || undefined, search: search || undefined });
  }

  return (
    <div data-testid="order-table">
      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          data-testid="order-table-search"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); onFilterChange({ status: e.target.value || undefined, search: search || undefined }); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          data-testid="order-table-status-filter"
        >
          {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button type="submit" className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90" data-testid="order-table-search-button">
          Buscar
        </button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Código</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Cliente</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => (
              <tr key={order.orderId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/pedidos/${order.orderId}`} className="font-mono text-brand-primary hover:underline" data-testid={`order-row-${order.orderId}`}>
                    {order.orderCode}
                  </Link>
                  {order.type === 'B2B' && <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">B2B</span>}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-gray-600 truncate max-w-[150px]">{order.customerName ?? order.customerEmail ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">S/ {(order.totalCents / 100).toFixed(2)}</td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-500">{new Date(order.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin pedidos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
