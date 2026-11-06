'use client';

import { useState } from 'react';
import { Search, ArrowDown, ArrowUp } from 'lucide-react';
import { backofficeApi, type LotTraceability, type LotSearchResult, type RecallReport, type PackagedLotStatus } from '@/lib/api';
import { usePermissions } from '@/contexts/permissions-context';
import { recallTotals, validateStatusChange } from '@/lib/recall';
import { apiErrorMessage } from '@/lib/api-errors';

const LOT_STATUSES: PackagedLotStatus[] = ['AVAILABLE', 'QUARANTINE', 'BLOCKED', 'DEPLETED'];

export default function TrazabilidadAdminPage() {
  const { can } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LotSearchResult[]>([]);
  const [selectedLot, setSelectedLot] = useState<LotTraceability | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PackagedLotStatus | ''>('');
  const [reason, setReason] = useState('');
  const [recall, setRecall] = useState<RecallReport | null>(null);
  const [loadingRecall, setLoadingRecall] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSelectedLot(null);
    setRecall(null);
    try {
      const results = await backofficeApi.searchLots(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectLot(lotCode: string) {
    setLoading(true);
    setRecall(null);
    setStatus('');
    setReason('');
    try {
      const data = await backofficeApi.getLotTraceability(lotCode);
      setSelectedLot(data);
    } catch {
      setSelectedLot(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLot || !status) return;
    const validation = validateStatusChange({ status, reason });
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    setDone('');
    try {
      const result = await backofficeApi.setLotStatus(selectedLot.lot.lotCode, {
        status,
        reason: reason.trim(),
        actorId: '',
        at: new Date().toISOString(),
      });
      setDone(`Estado actualizado. Lotes afectados: ${result.affectedLots.length}`);
      setReason('');
      await handleSelectLot(selectedLot.lot.lotCode);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cambiar el estado'));
    }
  }

  async function handleRecall() {
    if (!selectedLot) return;
    setLoadingRecall(true);
    setError('');
    try {
      setRecall(await backofficeApi.getLotRecall(selectedLot.lot.lotCode));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cargar el recall'));
    } finally {
      setLoadingRecall(false);
    }
  }

  const totals = recall ? recallTotals(recall) : null;

  return (
    <div className="space-y-6" data-testid="trazabilidad-admin-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Trazabilidad de Lotes</h1>
      <p className="text-sm text-gray-500">Busca un lote por código para ver su trazabilidad bidireccional (insumos → producto → pedidos).</p>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código de lote..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            data-testid="traceability-search-input"
          />
        </div>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="traceability-search-button">
          Buscar
        </button>
      </form>

      {/* Search results */}
      {searchResults.length > 0 && !selectedLot && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {searchResults.map((lot) => (
            <button
              key={lot.lotCode}
              onClick={() => handleSelectLot(lot.lotCode)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
              data-testid={`lot-result-${lot.lotCode}`}
            >
              <div>
                <p className="font-mono text-sm font-medium text-brand-primary">{lot.lotCode}</p>
                <p className="text-xs text-gray-500">{lot.productName} · {lot.sku}</p>
              </div>
              <span className="text-xs text-gray-400">{lot.roastDate ? new Date(lot.roastDate).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
            </button>
          ))}
        </div>
      )}

      {/* Traceability detail */}
      {selectedLot && (
        <div className="space-y-4">
          {/* Lot info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary font-mono text-sm font-semibold rounded-full">{selectedLot.lot.lotCode}</span>
              <span className="text-sm text-gray-600">{selectedLot.lot.productName}</span>
            </div>
            <p className="text-xs text-gray-400">SKU: {selectedLot.lot.sku} · Tostado: {new Date(selectedLot.lot.roastDate).toLocaleDateString('es-PE')}</p>
          </div>

          {/* Backward traceability */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-blue-600" /> Trazabilidad hacia atrás (insumos)
            </h3>
            {selectedLot.backward.length === 0 ? (
              <p className="text-sm text-gray-400">Sin insumos registrados (lote raíz o importado)</p>
            ) : (
              <div className="space-y-2">
                {selectedLot.backward.map((link, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-blue-50 rounded">
                    <span className="font-mono text-xs text-blue-700">{link.lotCode}</span>
                    <span className="text-xs text-gray-500">{link.sku}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{link.relation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Forward traceability */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-green-600" /> Trazabilidad hacia adelante (pedidos)
            </h3>
            {selectedLot.forward.length === 0 ? (
              <p className="text-sm text-gray-400">Sin pedidos asociados a este lote</p>
            ) : (
              <div className="space-y-2">
                {selectedLot.forward.map((link, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-green-50 rounded" data-testid={`forward-order-${link.orderId}`}>
                    <span className="font-mono text-xs text-green-700">{link.orderCode}</span>
                    {link.customerName && <span className="text-xs text-gray-500">{link.customerName}</span>}
                    <span className="text-xs text-gray-500">×{link.quantity ?? '—'}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {[link.dispatchedAt ? new Date(link.dispatchedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '', link.courierName, link.trackingNumber].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lot status + recall */}
          {can('inventory:lot:status') && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="lot-status-panel">
              <h3 className="text-sm font-semibold text-gray-700">Estado del lote y recall</h3>
              <form onSubmit={handleStatusChange} className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="lot-status" className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select id="lot-status" value={status} onChange={(e) => setStatus(e.target.value as PackagedLotStatus | '')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="lot-status-select">
                    <option value="">Seleccionar...</option>
                    {LOT_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-48">
                  <label htmlFor="lot-status-reason" className="block text-sm font-medium text-gray-700 mb-1">Motivo (obligatorio)</label>
                  <input id="lot-status-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="lot-status-reason" />
                </div>
                <button type="submit" className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg disabled:opacity-50" disabled={!status} data-testid="lot-status-submit">
                  Cambiar estado
                </button>
                <button type="button" onClick={handleRecall} disabled={loadingRecall} className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg disabled:opacity-50" data-testid="lot-recall-button">
                  {loadingRecall ? 'Cargando...' : 'Ver recall'}
                </button>
              </form>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {done && <p className="text-sm text-green-700">{done}</p>}

              {recall && totals && (
                <div className="space-y-2" data-testid="lot-recall">
                  <p className="text-sm text-gray-700">
                    Unidades en stock: <span className="font-medium">{totals.unitsInStock}</span> · Pedidos afectados: <span className="font-medium">{totals.ordersAffected}</span>
                  </p>
                  {recall.remainingByLocation.map((r) => (
                    <p key={`${r.locationId}-${r.lotCode}`} className="text-xs text-gray-500 font-mono">
                      {r.locationId}: {r.lotCode} ×{r.quantity}
                    </p>
                  ))}
                  {recall.affectedOrders.map((o) => (
                    <div key={o.orderId} className="flex items-center gap-3 p-2 bg-red-50 rounded text-xs" data-testid={`recall-order-${o.orderId}`}>
                      <span className="font-mono font-medium">{o.orderCode}</span>
                      {o.customerName && <span className="text-gray-500">{o.customerName}</span>}
                      <span className="text-gray-400 ml-auto">
                        {[o.dispatchedAt ? new Date(o.dispatchedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '', o.fulfillmentLocationId, o.courierName, o.trackingNumber].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={() => { setSelectedLot(null); setSearchResults([]); setSearchQuery(''); setRecall(null); }} className="text-sm text-gray-500 hover:text-gray-700 underline" data-testid="traceability-back">
            ← Nueva búsqueda
          </button>
        </div>
      )}
    </div>
  );
}
