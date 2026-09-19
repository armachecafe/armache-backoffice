'use client';

import { useState } from 'react';
import { Search, ArrowDown, ArrowUp } from 'lucide-react';
import { backofficeApi, type LotTraceability, type LotSearchResult } from '@/lib/api';

export default function TrazabilidadAdminPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LotSearchResult[]>([]);
  const [selectedLot, setSelectedLot] = useState<LotTraceability | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSelectedLot(null);
    try {
      const results = await backofficeApi.searchLots(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectLot(lotId: string) {
    setLoading(true);
    try {
      const data = await backofficeApi.getLotTraceability(lotId);
      setSelectedLot(data);
    } catch {
      setSelectedLot(null);
    } finally {
      setLoading(false);
    }
  }

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
              key={lot.lotId}
              onClick={() => handleSelectLot(lot.lotId)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
              data-testid={`lot-result-${lot.lotId}`}
            >
              <div>
                <p className="font-mono text-sm font-medium text-brand-primary">{lot.lotCode}</p>
                <p className="text-xs text-gray-500">{lot.productName} · {lot.sku}</p>
              </div>
              <span className="text-xs text-gray-400">{new Date(lot.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
            <p className="text-xs text-gray-400">SKU: {selectedLot.lot.sku} · Creado: {new Date(selectedLot.lot.createdAt).toLocaleDateString('es-PE')}</p>
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
                    <span className="font-mono text-xs text-blue-700">{link.ancestorLotCode}</span>
                    <span className="text-xs text-gray-500">{link.ancestorSku}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{link.relationship}</span>
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
                  <div key={i} className="flex items-center gap-3 p-2 bg-green-50 rounded">
                    <span className="font-mono text-xs text-green-700">{link.orderCode}</span>
                    {link.customerName && <span className="text-xs text-gray-500">{link.customerName}</span>}
                    <span className="text-[10px] text-gray-400 ml-auto">{new Date(link.linkedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { setSelectedLot(null); setSearchResults([]); setSearchQuery(''); }} className="text-sm text-gray-500 hover:text-gray-700 underline" data-testid="traceability-back">
            ← Nueva búsqueda
          </button>
        </div>
      )}
    </div>
  );
}
