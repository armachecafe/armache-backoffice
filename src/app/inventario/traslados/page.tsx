'use client';

import { useEffect, useState } from 'react';
import { backofficeApi, type InventoryTransfer, type Location } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { LocationPicker } from '@/components/inventory/location-picker';
import { ScanInput } from '@/components/inventory/scan-input';
import { parseScan, addCountScan } from '@/lib/scan-session';
import { validateNewTransfer } from '@/lib/transfers';
import { apiErrorMessage } from '@/lib/api-errors';

export default function TrasladosPage() {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [outgoing, setOutgoing] = useState<InventoryTransfer[]>([]);
  const [incoming, setIncoming] = useState<InventoryTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [destId, setDestId] = useState('');
  const [scanned, setScanned] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    backofficeApi.listLocations().then(setLocations).catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    if (!locationId) {
      setOutgoing([]);
      setIncoming([]);
      return;
    }
    setLoading(true);
    Promise.all([
      backofficeApi.listInventoryTransfers({ fromLocationId: locationId }).catch(() => [] as InventoryTransfer[]),
      backofficeApi.listInventoryTransfers({ toLocationId: locationId }).catch(() => [] as InventoryTransfer[]),
    ])
      .then(([from, to]) => {
        setOutgoing(from.filter((t) => t.status === 'REQUESTED' || t.status === 'IN_TRANSIT'));
        setIncoming(to.filter((t) => t.status === 'IN_TRANSIT'));
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  async function handleScan(raw: string) {
    setError('');
    setDone('');
    const parsed = parseScan(raw);
    if (!parsed.ok) {
      setError('Código ilegible');
      return;
    }
    try {
      await backofficeApi.getLot(parsed.lotCode);
      setScanned((c) => addCountScan(c, parsed.lotCode));
    } catch {
      setError(`Lote desconocido: ${parsed.lotCode}. Los traslados solo mueven lotes registrados.`);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const lines = Object.entries(scanned).map(([lotCode, quantity]) => ({ lotCode, quantity }));
    const validation = validateNewTransfer({ fromLocationId: locationId, toLocationId: destId, lines });
    if (validation || !destId) {
      setError(validation ?? 'Elegí el destino');
      return;
    }
    setSubmitting(true);
    setError('');
    setDone('');
    try {
      const lots = await Promise.all(
        lines.map(async (l) => {
          const lot = await backofficeApi.getLot(l.lotCode);
          return { ...l, sku: lot.sku };
        }),
      );
      const bySku = new Map<string, { sku: string; quantity: number; lots: { lotCode: string; shipped: number }[] }>();
      for (const l of lots) {
        const entry = bySku.get(l.sku) ?? { sku: l.sku, quantity: 0, lots: [] };
        entry.quantity += l.quantity;
        entry.lots.push({ lotCode: l.lotCode, shipped: l.quantity });
        bySku.set(l.sku, entry);
      }
      await backofficeApi.createInventoryTransfer({
        transferReferenceId: crypto.randomUUID(),
        fromLocationId: locationId,
        toLocationId: destId,
        lines: [...bySku.values()],
        actorId: user?.userId ?? '',
        at: new Date().toISOString(),
      });
      setDone('Traslado creado');
      setScanned({});
      setDestId('');
      const from = await backofficeApi
        .listInventoryTransfers({ fromLocationId: locationId })
        .catch(() => [] as InventoryTransfer[]);
      setOutgoing(from.filter((t) => t.status === 'REQUESTED' || t.status === 'IN_TRANSIT'));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo crear el traslado'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="traslados-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Traslados</h1>

      <LocationPicker value={locationId} onChange={setLocationId} />

      {locationId && (
        <>
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Salientes</h2>
            {loading ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : outgoing.length === 0 ? (
              <p className="text-sm text-gray-400" data-testid="traslados-out-empty">Sin traslados salientes.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="traslados-out">
                {outgoing.map((t) => (
                  <div key={t.transferId} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm font-medium text-brand-primary">{t.transferId}</p>
                      <p className="text-xs text-gray-500">{t.status} · {t.lines.reduce((n, l) => n + l.quantity, 0)} u.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Entrantes</h2>
            {incoming.length === 0 && !loading ? (
              <p className="text-sm text-gray-400" data-testid="traslados-in-empty">Sin traslados entrantes.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="traslados-in">
                {incoming.map((t) => (
                  <div key={t.transferId} className="px-4 py-3">
                    <p className="font-mono text-sm font-medium text-brand-primary">{t.transferId}</p>
                    <p className="text-xs text-gray-500">{t.status} · {t.lines.reduce((n, l) => n + l.quantity, 0)} u.</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="traslado-new">
            <h2 className="text-lg font-semibold text-gray-800">Nuevo traslado</h2>
            <div>
              <label htmlFor="traslado-dest" className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
              <select id="traslado-dest" value={destId} onChange={(e) => setDestId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="traslado-dest">
                <option value="">Seleccionar destino...</option>
                {locations
                  .filter((l) => l.locationId !== locationId)
                  .map((l) => (
                    <option key={l.locationId} value={l.locationId}>{l.name} ({l.code})</option>
                  ))}
              </select>
            </div>

            <ScanInput onScan={handleScan} placeholder="Escanear bolsas a enviar..." />

            {Object.keys(scanned).length > 0 && (
              <div className="space-y-2" data-testid="traslado-lines">
                {Object.entries(scanned).map(([lotCode, qty]) => (
                  <div key={lotCode} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <span className="font-mono text-sm flex-1">{lotCode}</span>
                    <span className="text-sm text-gray-600">× {qty}</span>
                    <button type="button" onClick={() => setScanned((c) => { const next = { ...c }; delete next[lotCode]; return next; })} className="text-sm text-gray-400 hover:text-red-600" data-testid={`traslado-remove-${lotCode}`}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {done && <p className="text-sm text-green-700">{done}</p>}

            <button onClick={handleCreate} disabled={submitting || !destId || Object.keys(scanned).length === 0} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="traslado-submit">
              {submitting ? 'Creando...' : 'Crear traslado'}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
