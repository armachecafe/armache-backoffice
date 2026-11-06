'use client';

import { useState } from 'react';
import { backofficeApi, type BackofficeProduct } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { LocationPicker } from '@/components/inventory/location-picker';
import { ScanInput } from '@/components/inventory/scan-input';
import { parseScan, addCountScan } from '@/lib/scan-session';
import { buildCountRequest } from '@/lib/count';
import { apiErrorMessage } from '@/lib/api-errors';

interface NewLotForm {
  lotCode: string;
  sku: string;
  roastedAt: string;
  bestBefore: string;
  initialGrams: string;
}

export default function ConteosPage() {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [countReferenceId, setCountReferenceId] = useState(() => crypto.randomUUID());
  const [newLot, setNewLot] = useState<NewLotForm | null>(null);
  const [products, setProducts] = useState<BackofficeProduct[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [savingLot, setSavingLot] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  function resetCount() {
    setCounts({});
    setReason('');
    setNewLot(null);
    setError('');
    setCountReferenceId(crypto.randomUUID());
  }

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
      setCounts((c) => addCountScan(c, parsed.lotCode));
    } catch {
      const products = await backofficeApi.listProducts({ pageSize: 50 }).catch(() => ({ items: [] as BackofficeProduct[] }));
      setProducts(products.items ?? []);
      setNewLot({ lotCode: parsed.lotCode, sku: '', roastedAt: '', bestBefore: parsed.bestBefore ?? '', initialGrams: '' });
    }
  }

  async function handleSaveNewLot(e: React.FormEvent) {
    e.preventDefault();
    if (!newLot || !newLot.sku || !newLot.roastedAt || !newLot.bestBefore) return;
    const grams = Math.floor(Number(newLot.initialGrams));
    if (!Number.isInteger(grams) || grams <= 0) {
      setError('Indicá los gramos iniciales');
      return;
    }
    setSavingLot(true);
    setError('');
    try {
      await backofficeApi.createLot({
        lotReferenceId: crypto.randomUUID(),
        lotCode: newLot.lotCode,
        sku: newLot.sku,
        roastedAt: new Date(newLot.roastedAt).toISOString(),
        bestBefore: new Date(newLot.bestBefore).toISOString(),
        locationId,
        initialQuantityGrams: grams,
        actorId: user?.userId ?? '',
        at: new Date().toISOString(),
      });
      setCounts((c) => ({ ...c, [newLot.lotCode]: c[newLot.lotCode] ?? 0 }));
      setNewLot(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo registrar el lote'));
    } finally {
      setSavingLot(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const built = buildCountRequest({
      referenceId: countReferenceId,
      locationId,
      reason,
      counts,
      actorId: user?.userId ?? '',
      at: new Date().toISOString(),
    });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    if (Object.keys(counts).length === 0) {
      setError('Agregá al menos un lote al conteo');
      return;
    }
    setSubmitting(true);
    setError('');
    setDone('');
    try {
      await backofficeApi.createCount(built.request);
      setDone('Conteo registrado');
      resetCount();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo registrar el conteo'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="conteos-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Conteos</h1>

      <LocationPicker value={locationId} onChange={(id) => { setLocationId(id); resetCount(); }} />

      {locationId && (
        <>
          <p className="text-sm text-gray-500">
            Solo se ajustan los lotes de este conteo. Para dejar un lote en 0, contalo con cantidad 0.
          </p>

          <ScanInput onScan={handleScan} placeholder="Escanear bolsa (GS1-128)..." />

          {newLot && (
            <form onSubmit={handleSaveNewLot} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="new-lot-form">
              <h3 className="text-sm font-semibold text-gray-700">
                Lote nuevo: <span className="font-mono text-brand-primary">{newLot.lotCode}</span>
              </h3>
              <div>
                <label htmlFor="new-lot-sku" className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <select id="new-lot-sku" value={newLot.sku} onChange={(e) => setNewLot({ ...newLot, sku: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="new-lot-sku">
                  <option value="">Seleccionar SKU...</option>
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-lot-roasted" className="block text-sm font-medium text-gray-700 mb-1">Fecha de tostado</label>
                  <input id="new-lot-roasted" type="date" value={newLot.roastedAt} onChange={(e) => setNewLot({ ...newLot, roastedAt: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="new-lot-roasted" />
                </div>
                <div>
                  <label htmlFor="new-lot-best-before" className="block text-sm font-medium text-gray-700 mb-1">Vencimiento</label>
                  <input id="new-lot-best-before" type="date" value={newLot.bestBefore} onChange={(e) => setNewLot({ ...newLot, bestBefore: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="new-lot-best-before" />
                </div>
              </div>
              <div>
                <label htmlFor="new-lot-grams" className="block text-sm font-medium text-gray-700 mb-1">Cantidad inicial (gramos, entero)</label>
                <input id="new-lot-grams" type="number" min="1" step="1" value={newLot.initialGrams} onChange={(e) => setNewLot({ ...newLot, initialGrams: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: 5000" data-testid="new-lot-grams" />
              </div>
              <button type="submit" disabled={savingLot || !newLot.sku || !newLot.roastedAt || !newLot.bestBefore || !newLot.initialGrams} className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg disabled:opacity-50" data-testid="new-lot-submit">
                {savingLot ? 'Registrando...' : 'Registrar lote'}
              </button>
            </form>
          )}

          {Object.keys(counts).length > 0 && (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="count-lines">
              {Object.entries(counts).map(([lotCode, qty]) => (
                <div key={lotCode} className="flex items-center gap-3 px-4 py-3">
                  <span className="font-mono text-sm font-medium text-brand-primary flex-1">{lotCode}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={qty}
                    onChange={(e) => setCounts((c) => ({ ...c, [lotCode]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                    className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                    data-testid={`count-qty-${lotCode}`}
                  />
                  <button type="button" onClick={() => setCounts((c) => { const next = { ...c }; delete next[lotCode]; return next; })} className="text-sm text-gray-400 hover:text-red-600" data-testid={`count-remove-${lotCode}`}>
                    Quitar
                  </button>
                </div>
              ))}
              <div className="px-4 py-3">
                <label htmlFor="count-reason" className="block text-sm font-medium text-gray-700 mb-1">Motivo (obligatorio)</label>
                <input id="count-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: conteo inicial CD Norte" data-testid="count-reason" />
              </div>
              <div className="px-4 py-3">
                <button type="submit" disabled={submitting} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="count-submit">
                  {submitting ? 'Registrando...' : 'Registrar conteo'}
                </button>
              </div>
            </form>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && <p className="text-sm text-green-700">{done}</p>}
        </>
      )}
    </div>
  );
}
