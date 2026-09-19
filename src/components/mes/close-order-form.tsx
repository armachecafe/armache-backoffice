'use client';

import { useState } from 'react';
import { backofficeApi, type ProductionOrder } from '@/lib/api';

interface CloseOrderFormProps {
  order: ProductionOrder;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CloseOrderForm({ order, onSuccess, onCancel }: CloseOrderFormProps) {
  const [outputQtyKg, setOutputQtyKg] = useState('');
  const [wasteKg, setWasteKg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const output = Number(outputQtyKg) || 0;
  const waste = Number(wasteKg) || 0;
  const total = output + waste;
  const isValid = output > 0 && total <= order.inputQtyKg;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.closeProductionOrder(order.orderId, { outputQtyKg: output, wasteKg: waste });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar orden');
    } finally {
      setSubmitting(false);
    }
  }

  const processLabels: Record<string, string> = { ROASTING: 'Tostado', GRINDING: 'Molido', PACKAGING: 'Empacado' };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="close-order-form">
      {/* Order info */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-sm font-medium text-gray-900">{processLabels[order.process] ?? order.process}</p>
        <p className="text-xs text-gray-500">Insumo: {order.inputSku} · Lote: {order.inputLotCode}</p>
        <p className="text-xs text-gray-500">Cantidad ingresada: <span className="font-semibold">{order.inputQtyKg} kg</span></p>
      </div>

      <div>
        <label htmlFor="output-qty" className="block text-sm font-medium text-gray-700 mb-1">Producido (kg)</label>
        <input
          id="output-qty"
          type="number"
          step="0.1"
          min="0.1"
          required
          value={outputQtyKg}
          onChange={(e) => setOutputQtyKg(e.target.value)}
          placeholder="8.5"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-right"
          data-testid="close-order-output"
        />
      </div>

      <div>
        <label htmlFor="waste-qty" className="block text-sm font-medium text-gray-700 mb-1">Merma (kg)</label>
        <input
          id="waste-qty"
          type="number"
          step="0.1"
          min="0"
          required
          value={wasteKg}
          onChange={(e) => setWasteKg(e.target.value)}
          placeholder="1.5"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-right"
          data-testid="close-order-waste"
        />
      </div>

      {/* Validation feedback */}
      <div className={`p-2 rounded text-sm ${total > order.inputQtyKg ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
        Producido + Merma = {total.toFixed(1)} kg / {order.inputQtyKg} kg
        {total > order.inputQtyKg && ' ⚠️ Excede el ingresado'}
      </div>

      {error && <p className="text-sm text-red-600" data-testid="close-order-error">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50" data-testid="close-order-cancel">
          Cancelar
        </button>
        <button type="submit" disabled={submitting || !isValid} className="flex-1 py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="close-order-submit">
          {submitting ? 'Cerrando...' : 'Cerrar Orden'}
        </button>
      </div>
    </form>
  );
}
