'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { backofficeApi, type HarvestRecord } from '@/lib/api';
import { farmSelectState, NO_FARMS_MESSAGE } from '@/lib/harvest';

export default function CosechasPage() {
  const [farms, setFarms] = useState<{ farmId: string }[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(true);
  const [farmId, setFarmId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [selected, setSelected] = useState<HarvestRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFarmsLoading(true);
    backofficeApi
      .listHarvestFarms()
      .then(setFarms)
      .catch(() => {})
      .finally(() => setFarmsLoading(false));
  }, []);

  useEffect(() => {
    if (!farmId) {
      setHarvests([]);
      setSelected(null);
      return;
    }
    setLoading(true);
    backofficeApi
      .listHarvests({ farmId, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
      .then((items) => {
        setHarvests(items);
        setSelected(null);
      })
      .catch(() => {
        setHarvests([]);
        setSelected(null);
      })
      .finally(() => setLoading(false));
  }, [farmId, dateFrom, dateTo]);

  async function handleSelect(harvestId: string) {
    setLoading(true);
    try {
      const data = await backofficeApi.getHarvest(harvestId);
      setSelected(data);
    } catch {
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="cosechas-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-gray-900">Cosechas</h1>
        <Link
          href="/finca/cosechas/nueva"
          className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90"
          data-testid="cosechas-new-link"
        >
          Nueva Cosecha
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={farmId}
          onChange={(e) => setFarmId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          data-testid="cosechas-farm-filter"
        >
          <option value="">Seleccionar finca...</option>
          {farms.map((f) => (
            <option key={f.farmId} value={f.farmId}>{f.farmId}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          aria-label="Desde"
          data-testid="cosechas-date-from"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          aria-label="Hasta"
          data-testid="cosechas-date-to"
        />
      </div>

      {!farmId ? (
        farmSelectState({ loading: farmsLoading, loadError: false, farms }) === 'empty' ? (
          <p className="text-sm text-amber-700" data-testid="cosechas-no-farms-options">
            {NO_FARMS_MESSAGE}
          </p>
        ) : (
          <p className="text-sm text-gray-400" data-testid="cosechas-no-farm">
            Seleccioná una finca para ver sus cosechas.
          </p>
        )
      ) : loading && harvests.length === 0 && !selected ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : harvests.length === 0 ? (
        <p className="text-sm text-gray-400" data-testid="cosechas-empty">
          Sin cosechas para esta finca en el rango elegido.
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="cosechas-table">
          {harvests.map((h) => (
            <button
              key={h.harvestId}
              onClick={() => handleSelect(h.harvestId)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
              data-testid={`cosecha-row-${h.harvestId}`}
            >
              <div>
                <p className="font-mono text-sm font-medium text-brand-primary">{h.harvestReferenceId}</p>
                <p className="text-xs text-gray-500">{h.cherryKgGrams} g · {h.quality} · {h.harvester}</p>
              </div>
              <span className="text-xs text-gray-400">{new Date(h.harvestedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2" data-testid="cosecha-detail">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary font-mono text-sm font-semibold rounded-full">{selected.harvestReferenceId}</span>
            <span className="text-sm text-gray-600">{selected.farmId}</span>
          </div>
          <p className="text-sm text-gray-700">Cereza: <span className="font-medium">{selected.cherryKgGrams} g</span> · Calidad: <span className="font-medium">{selected.quality}</span></p>
          <p className="text-sm text-gray-700">Cosechador: <span className="font-medium">{selected.harvester}</span></p>
          <p className="text-xs text-gray-400">
            Cosechada: {new Date(selected.harvestedAt).toLocaleString('es-PE')} · Registrada: {new Date(selected.createdAt).toLocaleString('es-PE')}
          </p>
          {selected.farmGeo && (
            <p className="text-xs text-gray-400">Ubicación: {selected.farmGeo.lat}, {selected.farmGeo.lon}</p>
          )}
          <button onClick={() => setSelected(null)} className="text-sm text-gray-500 hover:text-gray-700 underline" data-testid="cosecha-detail-back">
            ← Volver a la lista
          </button>
        </div>
      )}
    </div>
  );
}
