'use client';

import { useState } from 'react';
import { backofficeApi } from '@/lib/api';
import { RotateCcw } from 'lucide-react';

export default function DevolucionesPage() {
  const [orderId, setOrderId] = useState('');
  const [items, setItems] = useState([{ sku: '', quantity: '', reason: 'error_envio' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reasons = [
    { value: 'error_envio', label: 'Error de envío' },
    { value: 'defectuoso', label: 'Producto defectuoso' },
    { value: 'no_satisfecho', label: 'Cliente no satisfecho' },
  ];

  function addItem() {
    setItems([...items, { sku: '', quantity: '', reason: 'error_envio' }]);
  }

  function updateItem(idx: number, field: string, value: string) {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId || items.every((i) => !i.sku)) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const returnItems = items
        .filter((i) => i.sku && Number(i.quantity) > 0)
        .map((i) => ({ sku: i.sku, quantity: Number(i.quantity), reason: i.reason }));
      const result = await backofficeApi.createReturn(orderId, returnItems);
      setSuccess(`Devolución registrada: ${result.returnId}`);
      setOrderId('');
      setItems([{ sku: '', quantity: '', reason: 'error_envio' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar devolución');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6" data-testid="devoluciones-page">
      <div className="flex items-center gap-3">
        <RotateCcw className="w-6 h-6 text-brand-primary" />
        <h1 className="text-2xl font-display font-bold text-gray-900">Devoluciones</h1>
      </div>
      <p className="text-sm text-gray-500">Registra la devolución de items de un pedido. Si el motivo permite reingreso, el Jefe de Almacén debe confirmar la recepción física.</p>

      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" data-testid="return-success">{success}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="return-order" className="block text-sm font-medium text-gray-700 mb-1">ID del Pedido *</label>
          <input id="return-order" type="text" required value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="orderId del pedido original" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="return-order-id" />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-700">Items a devolver</legend>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 flex-wrap">
              <input type="text" placeholder="SKU" value={item.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="w-32 px-2 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`return-item-sku-${idx}`} />
              <input type="number" placeholder="Qty" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`return-item-qty-${idx}`} />
              <select value={item.reason} onChange={(e) => updateItem(idx, 'reason', e.target.value)} className="flex-1 min-w-[140px] px-2 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`return-item-reason-${idx}`}>
                {reasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-sm text-brand-primary hover:underline" data-testid="return-add-item">+ Agregar item</button>
        </fieldset>

        <button type="submit" disabled={submitting || !orderId} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="return-submit">
          {submitting ? 'Registrando...' : 'Registrar Devolución'}
        </button>
      </form>
    </div>
  );
}
