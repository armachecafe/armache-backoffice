'use client';

import { useEffect, useState } from 'react';
import { backofficeApi, type StockRow, type InventoryMovement } from '@/lib/api';
import { sortStockFefo, lotStatusLabel } from '@/lib/stock';
import { LocationPicker } from '@/components/inventory/location-picker';

export default function StockPage() {
  const [locationId, setLocationId] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [rows, setRows] = useState<StockRow[]>([]);
  const [selected, setSelected] = useState<{ lotCode: string; movements: InventoryMovement[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    backofficeApi
      .getStock()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = sortStockFefo(
    rows.filter(
      (r) =>
        (!locationId || r.locationId === locationId) &&
        (!skuFilter || r.sku.toLowerCase().includes(skuFilter.toLowerCase())) &&
        (!lotFilter || r.lotCode.toLowerCase().includes(lotFilter.toLowerCase())),
    ),
  );

  async function handleSelect(lotCode: string, rowLocationId: string) {
    const movements = (await backofficeApi.listMovements().catch(() => [] as InventoryMovement[])).filter(
      (m) => m.lotCode === lotCode && m.locationId === rowLocationId,
    );
    setSelected({ lotCode, movements });
  }

  return (
    <div className="space-y-6" data-testid="stock-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Stock por lote</h1>

      <div className="flex flex-wrap items-end gap-3">
        <LocationPicker value={locationId} onChange={(id) => { setLocationId(id); setSelected(null); }} />
        <div>
          <label htmlFor="stock-sku" className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
          <input id="stock-sku" type="text" value={skuFilter} onChange={(e) => setSkuFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Filtrar SKU..." data-testid="stock-sku-filter" />
        </div>
        <div>
          <label htmlFor="stock-lot" className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
          <input id="stock-lot" type="text" value={lotFilter} onChange={(e) => setLotFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Filtrar lote..." data-testid="stock-lot-filter" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400" data-testid="stock-empty">Sin stock para los filtros elegidos.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="stock-table">
          {filtered.map((r) => (
            <button
              key={`${r.locationId}-${r.lotCode}-${r.sku}`}
              onClick={() => handleSelect(r.lotCode, r.locationId)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
              data-testid={`stock-row-${r.lotCode}`}
            >
              <div>
                <p className="font-mono text-sm font-medium text-brand-primary">{r.lotCode} <span className="text-gray-400">{r.sku}</span></p>
                <p className="text-xs text-gray-500">
                  En mano: {r.onHand} · Reservado: {r.reserved} · Asignado: {r.allocated} ·{' '}
                  <span className="font-medium">Disponible: {r.available}</span> · Vence: {new Date(r.bestBefore).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <span className="text-xs font-medium text-gray-600">{lotStatusLabel(r.lotStatus)}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2" data-testid="stock-movements">
          <h3 className="text-sm font-semibold text-gray-700">
            Movimientos de <span className="font-mono text-brand-primary">{selected.lotCode}</span>
          </h3>
          {selected.movements.length === 0 ? (
            <p className="text-sm text-gray-400">Sin movimientos registrados.</p>
          ) : (
            selected.movements.map((m) => (
              <div key={m.movementId} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-xs">
                <span className="font-medium text-gray-700">{m.type}</span>
                <span className="font-mono">{m.quantity}</span>
                {m.reason && <span className="text-gray-500">{m.reason}</span>}
                <span className="text-gray-400 ml-auto">{new Date(m.at).toLocaleString('es-PE', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))
          )}
          <button onClick={() => setSelected(null)} className="text-sm text-gray-500 hover:text-gray-700 underline" data-testid="stock-movements-close">
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
