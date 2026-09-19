'use client';

import { useState, useEffect } from 'react';
import { backofficeApi, type PurchaseOrder } from '@/lib/api';

interface ReceptionFormProps {
  onSuccess: () => void;
}

export function ReceptionForm({ onSuccess }: ReceptionFormProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [lines, setLines] = useState<{ sku: string; productName: string; orderedQty: number; receivedQty: number; unit: string; inputQty: string }[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    backofficeApi.listPurchaseOrders().then(setPurchaseOrders).catch(() => {});
  }, []);

  function handlePoSelect(poId: string) {
    setSelectedPoId(poId);
    const po = purchaseOrders.find((p) => p.poId === poId);
    if (po) {
      setLines(po.lines.map((l) => ({ ...l, inputQty: '' })));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPoId || lines.every((l) => !l.inputQty)) return;
    setSubmitting(true);
    setError('');
    try {
      const receptionLines = lines
        .filter((l) => Number(l.inputQty) > 0)
        .map((l) => ({ sku: l.sku, receivedQty: Number(l.inputQty) }));
      await backofficeApi.createReception(selectedPoId, receptionLines, note || undefined);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar recepción');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="reception-form">
      <div>
        <label htmlFor="po-select" className="block text-sm font-medium text-gray-700 mb-1">Orden de Compra</label>
        <select id="po-select" value={selectedPoId} onChange={(e) => handlePoSelect(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="reception-po-select">
          <option value="">Seleccionar PO...</option>
          {purchaseOrders.filter((p) => p.status !== 'CLOSED').map((po) => (
            <option key={po.poId} value={po.poId}>{po.poCode} — {po.supplier ?? 'Sin proveedor'} ({po.status})</option>
          ))}
        </select>
      </div>

      {lines.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Líneas de recepción:</p>
          {lines.map((line, idx) => (
            <div key={line.sku} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">{line.productName}</p>
                <p className="text-xs text-gray-500">Pedido: {line.orderedQty} {line.unit} · Recibido prev: {line.receivedQty} {line.unit}</p>
              </div>
              <input
                type="number"
                min="0"
                max={line.orderedQty - line.receivedQty}
                step="0.01"
                placeholder="Qty"
                value={line.inputQty}
                onChange={(e) => {
                  const updated = [...lines];
                  updated[idx] = { ...updated[idx], inputQty: e.target.value };
                  setLines(updated);
                }}
                className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                data-testid={`reception-qty-${line.sku}`}
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <label htmlFor="reception-note" className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
        <input id="reception-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: recepción parcial, faltante notificado" data-testid="reception-note" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting || !selectedPoId} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="reception-submit">
        {submitting ? 'Registrando...' : 'Confirmar Recepción'}
      </button>
    </form>
  );
}
