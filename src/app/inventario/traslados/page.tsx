'use client';

import { useEffect, useState } from 'react';
import { backofficeApi, type InventoryTransfer, type Location } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { LocationPicker } from '@/components/inventory/location-picker';
import { ScanInput } from '@/components/inventory/scan-input';
import { parseScan, addCountScan, addLineScan, isComplete, type PickLine } from '@/lib/scan-session';
import { validateNewTransfer, buildReceiveLines, receiveShortfall, type ReceivedLine } from '@/lib/transfers';
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
  const [shipTransfer, setShipTransfer] = useState<InventoryTransfer | null>(null);
  const [shipLines, setShipLines] = useState<PickLine[]>([]);
  const [shipScans, setShipScans] = useState<string[]>([]);
  const [receiveTransfer, setReceiveTransfer] = useState<InventoryTransfer | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceivedLine[]>([]);
  const [seenLots, setSeenLots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function reloadLists() {
    if (!locationId) return;
    const [from, to] = await Promise.all([
      backofficeApi.listInventoryTransfers({ fromLocationId: locationId }).catch(() => [] as InventoryTransfer[]),
      backofficeApi.listInventoryTransfers({ toLocationId: locationId }).catch(() => [] as InventoryTransfer[]),
    ]);
    setOutgoing(from.filter((t) => t.status === 'REQUESTED' || t.status === 'IN_TRANSIT'));
    setIncoming(to.filter((t) => t.status === 'IN_TRANSIT'));
  }

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
    reloadLists().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await reloadLists();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo crear el traslado'));
    } finally {
      setSubmitting(false);
    }
  }

  function openShip(t: InventoryTransfer) {
    setReceiveTransfer(null);
    setShipTransfer(t);
    setShipLines(
      t.lines.map((l) => ({
        sku: l.sku,
        quantity: l.quantity,
        lots: l.lots.filter((s) => s.shipped > 0).map((s) => ({ lotCode: s.lotCode, quantity: s.shipped })),
      })),
    );
    setShipScans([]);
    setError('');
  }

  async function handleShipScan(raw: string) {
    if (!shipTransfer) return;
    setError('');
    const parsed = parseScan(raw);
    if (!parsed.ok) {
      setError('Código ilegible');
      return;
    }
    let sku: string;
    try {
      sku = (await backofficeApi.getLot(parsed.lotCode)).sku;
    } catch {
      setError(`Lote desconocido: ${parsed.lotCode}`);
      return;
    }
    const result = addLineScan(shipLines, { lotCode: parsed.lotCode, sku });
    if (!result.ok) {
      setError(result.error === 'SKU_NOT_IN_LINES' ? 'Ese lote no es parte de este traslado' : 'Línea completa');
      return;
    }
    setShipLines(result.lines);
    setShipScans((s) => [...s, parsed.lotCode]);
  }

  async function handleShipConfirm() {
    if (!shipTransfer) return;
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.shipInventoryTransfer(shipTransfer.transferId, {
        shipReferenceId: crypto.randomUUID(),
        scans: shipScans,
        actorId: user?.userId ?? '',
        at: new Date().toISOString(),
      });
      setDone('Traslado enviado');
      setShipTransfer(null);
      await reloadLists();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo enviar el traslado'));
    } finally {
      setSubmitting(false);
    }
  }

  function openReceive(t: InventoryTransfer) {
    setShipTransfer(null);
    setReceiveTransfer(t);
    setReceiveLines(buildReceiveLines(t));
    setSeenLots([]);
    setError('');
  }

  function handleReceiveScan(raw: string) {
    const parsed = parseScan(raw);
    if (parsed.ok) setSeenLots((s) => (s.includes(parsed.lotCode) ? s : [...s, parsed.lotCode]));
  }

  async function handleReceiveConfirm() {
    if (!receiveTransfer) return;
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.receiveInventoryTransfer(receiveTransfer.transferId, {
        receiveReferenceId: crypto.randomUUID(),
        lines: receiveLines,
        actorId: user?.userId ?? '',
        at: new Date().toISOString(),
      });
      setDone('Traslado recibido');
      setReceiveTransfer(null);
      await reloadLists();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo recibir el traslado'));
    } finally {
      setSubmitting(false);
    }
  }

  const shippedLots = (receiveTransfer?.lines ?? []).flatMap((l) => l.lots);
  const shortfall = receiveShortfall(receiveLines, shippedLots);

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
                    {t.status === 'REQUESTED' && (
                      <button onClick={() => openShip(t)} className="text-sm text-brand-primary hover:underline" data-testid={`traslado-ship-${t.transferId}`}>
                        Enviar
                      </button>
                    )}
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
                  <div key={t.transferId} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm font-medium text-brand-primary">{t.transferId}</p>
                      <p className="text-xs text-gray-500">{t.status} · {t.lines.reduce((n, l) => n + l.quantity, 0)} u.</p>
                    </div>
                    <button onClick={() => openReceive(t)} className="text-sm text-brand-primary hover:underline" data-testid={`traslado-receive-${t.transferId}`}>
                      Recibir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {shipTransfer && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="traslado-ship-panel">
              <h2 className="text-lg font-semibold text-gray-800">Enviar {shipTransfer.transferId}</h2>
              <p className="text-sm text-gray-500">Escaneá cada bolsa. El envío se habilita al completar todas las líneas.</p>
              <ScanInput onScan={handleShipScan} placeholder="Escanear bolsa a enviar..." />
              <div className="space-y-2">
                {shipLines.map((l) => (
                  <div key={l.sku} className="p-2 bg-gray-50 rounded text-sm" data-testid={`ship-line-${l.sku}`}>
                    <span className="font-mono font-medium">{l.sku}</span>
                    <span className="text-gray-500"> · {l.lots.reduce((n, x) => n + x.quantity, 0)}/{l.quantity} u.</span>
                  </div>
                ))}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={handleShipConfirm} disabled={submitting || !isComplete(shipLines)} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg disabled:opacity-50" data-testid="traslado-ship-submit">
                {submitting ? 'Enviando...' : 'Confirmar envío'}
              </button>
            </section>
          )}

          {receiveTransfer && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="traslado-receive-panel">
              <h2 className="text-lg font-semibold text-gray-800">Recibir {receiveTransfer.transferId}</h2>
              <ScanInput onScan={handleReceiveScan} placeholder="Escanear bolsa recibida..." />
              <div className="space-y-2">
                {receiveLines.map((l) => (
                  <div key={l.lotCode} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <span className="font-mono text-sm flex-1">
                      {l.lotCode}
                      {seenLots.includes(l.lotCode) && <span className="ml-2 text-xs text-green-700">visto</span>}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={l.receivedQuantity}
                      onChange={(e) =>
                        setReceiveLines((lines) => lines.map((x) => (x.lotCode === l.lotCode ? { ...x, receivedQuantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : x)))
                      }
                      className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                      data-testid={`receive-qty-${l.lotCode}`}
                    />
                  </div>
                ))}
              </div>
              {shortfall.length > 0 && (
                <p className="text-sm text-amber-700" data-testid="traslado-shortfall">
                  Se registrará merma en tránsito: {shortfall.map((s) => `${s.lotCode} −${s.missing}`).join(', ')}
                </p>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={handleReceiveConfirm} disabled={submitting} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg disabled:opacity-50" data-testid="traslado-receive-submit">
                {submitting ? 'Recibiendo...' : 'Confirmar recepción'}
              </button>
            </section>
          )}

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

            {error && !shipTransfer && !receiveTransfer && <p className="text-sm text-red-600">{error}</p>}
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
