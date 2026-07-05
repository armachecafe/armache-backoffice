'use client';

import { useState } from 'react';
import { staffApi } from '@/lib/api';

const LOCATIONS = [
  { id: 'planta', name: 'Planta de Producción' },
  { id: 'almacen', name: 'Almacén/Tienda' },
];

interface TransferFormProps {
  onSuccess: () => void;
}

export function TransferForm({ onSuccess }: TransferFormProps) {
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [items, setItems] = useState([{ sku: '', quantity: '', lotCode: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function addItem() {
    setItems([...items, { sku: '', quantity: '', lotCode: '' }]);
  }

  function updateItem(idx: number, field: string, value: string) {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromLocation || !toLocation || fromLocation === toLocation) return;
    setSubmitting(true);
    setError('');
    try {
      await staffApi.createTransfer({
        fromLocation,
        toLocation,
        items: items.filter((i) => i.sku && Number(i.quantity) > 0).map((i) => ({
          sku: i.sku,
          quantity: Number(i.quantity),
          lotCode: i.lotCode || undefined,
        })),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear transferencia');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="transfer-form">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
          <select value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="transfer-from">
            <option value="">Seleccionar...</option>
            {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
          <select value={toLocation} onChange={(e) => setToLocation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="transfer-to">
            <option value="">Seleccionar...</option>
            {LOCATIONS.filter((l) => l.id !== fromLocation).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Items</p>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input type="text" placeholder="SKU" value={item.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`transfer-item-sku-${idx}`} />
            <input type="number" placeholder="Qty" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`transfer-item-qty-${idx}`} />
            <input type="text" placeholder="Lote" value={item.lotCode} onChange={(e) => updateItem(idx, 'lotCode', e.target.value)} className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`transfer-item-lot-${idx}`} />
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-sm text-brand-primary hover:underline" data-testid="transfer-add-item">+ Agregar item</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting || !fromLocation || !toLocation} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="transfer-submit">
        {submitting ? 'Creando...' : 'Crear Transferencia'}
      </button>
    </form>
  );
}
