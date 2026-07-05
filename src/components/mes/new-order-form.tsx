'use client';

import { useState } from 'react';
import { staffApi } from '@/lib/api';

interface NewOrderFormProps {
  onSuccess: () => void;
}

const PROCESSES = [
  { value: 'ROASTING', label: 'Tostado' },
  { value: 'GRINDING', label: 'Molido' },
  { value: 'PACKAGING', label: 'Empacado' },
];

export function NewOrderForm({ onSuccess }: NewOrderFormProps) {
  const [process, setProcess] = useState('ROASTING');
  const [inputSku, setInputSku] = useState('');
  const [inputLotCode, setInputLotCode] = useState('');
  const [inputQtyKg, setInputQtyKg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputSku || !inputLotCode || !inputQtyKg) return;
    setSubmitting(true);
    setError('');
    try {
      await staffApi.createProductionOrder({
        process,
        inputSku,
        inputLotCode,
        inputQtyKg: Number(inputQtyKg),
      });
      onSuccess();
      setInputSku('');
      setInputLotCode('');
      setInputQtyKg('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear orden');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="new-order-form">
      {/* Process selector — big buttons for mobile */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Proceso</label>
        <div className="grid grid-cols-3 gap-2">
          {PROCESSES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProcess(p.value)}
              className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                process === p.value
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              data-testid={`process-${p.value.toLowerCase()}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="input-sku" className="block text-sm font-medium text-gray-700 mb-1">Insumo (SKU)</label>
        <input
          id="input-sku"
          type="text"
          required
          value={inputSku}
          onChange={(e) => setInputSku(e.target.value)}
          placeholder="Ej: cafe-verde-1kg"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base"
          data-testid="new-order-input-sku"
        />
      </div>

      <div>
        <label htmlFor="input-lot" className="block text-sm font-medium text-gray-700 mb-1">Código de Lote</label>
        <input
          id="input-lot"
          type="text"
          required
          value={inputLotCode}
          onChange={(e) => setInputLotCode(e.target.value)}
          placeholder="Ej: LV-2026-0015"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base"
          data-testid="new-order-lot-code"
        />
      </div>

      <div>
        <label htmlFor="input-qty" className="block text-sm font-medium text-gray-700 mb-1">Cantidad ingresada (kg)</label>
        <input
          id="input-qty"
          type="number"
          step="0.1"
          min="0.1"
          required
          value={inputQtyKg}
          onChange={(e) => setInputQtyKg(e.target.value)}
          placeholder="10.0"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-right"
          data-testid="new-order-qty"
        />
      </div>

      {error && <p className="text-sm text-red-600" data-testid="new-order-error">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !inputSku || !inputLotCode || !inputQtyKg}
        className="w-full py-3.5 bg-brand-primary text-white font-semibold rounded-lg text-lg hover:bg-brand-primary/90 disabled:opacity-50"
        data-testid="new-order-submit"
      >
        {submitting ? 'Creando...' : 'Iniciar Orden'}
      </button>
    </form>
  );
}
