'use client';

import { useEffect, useState } from 'react';
import { backofficeApi, type BackofficeOrderSummary, type BackofficeOrderDetail } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { LocationPicker } from '@/components/inventory/location-picker';
import { ScanInput } from '@/components/inventory/scan-input';
import { parseScan, addLineScan, removeLineScan, isComplete, needsFefoReason, type PickLine } from '@/lib/scan-session';
import { pickLines, canStartPicking } from '@/lib/picking';
import { dispatchMode } from '@/lib/dispatch';
import { apiErrorMessage } from '@/lib/api-errors';

export default function PreparacionPage() {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState('');
  const [confirmed, setConfirmed] = useState<BackofficeOrderSummary[]>([]);
  const [preparing, setPreparing] = useState<BackofficeOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [lines, setLines] = useState<PickLine[]>([]);
  const [waitingTransfer, setWaitingTransfer] = useState(false);
  const [pendingScan, setPendingScan] = useState<{ lotCode: string; sku: string } | null>(null);
  const [fefoReason, setFefoReason] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function reloadQueues() {
    if (!locationId) return;
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        backofficeApi.listOrders({ status: 'CONFIRMED', assigned: true, fulfillmentLocationId: locationId, pageSize: 50 }).catch(() => ({ items: [] as BackofficeOrderSummary[] })),
        backofficeApi.listOrders({ status: 'PREPARING', fulfillmentLocationId: locationId, pageSize: 50 }).catch(() => ({ items: [] as BackofficeOrderSummary[] })),
      ]);
      setConfirmed(c.items);
      setPreparing(p.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOrderId(null);
    setLines([]);
    if (!locationId) {
      setConfirmed([]);
      setPreparing([]);
      return;
    }
    reloadQueues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function handleSelect(id: string) {
    setOrderId(id);
    setError('');
    setDone('');
    setPendingScan(null);
    setFefoReason('');
    try {
      const detail: BackofficeOrderDetail = await backofficeApi.getOrder(id);
      setLines(pickLines(detail.items));
      const linked = await backofficeApi
        .listInventoryTransfers({ forOrderId: id })
        .catch(() => [] as { status: string }[]);
      setWaitingTransfer(!canStartPicking(linked));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cargar el pedido'));
      setLines([]);
    }
  }

  async function handleStart(orderIdToStart: string) {
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.transitionOrder(orderIdToStart, 'PREPARING');
      await reloadQueues();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo pasar a preparación'));
    } finally {
      setSubmitting(false);
    }
  }

  async function doPick(lotCode: string, sku: string, reason?: string) {
    if (!orderId) return;
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.pickOrder(orderId, {
        pickReferenceId: crypto.randomUUID(),
        scans: [{ lotCode, quantity: 1 }],
        ...(reason ? { fefoReason: reason } : {}),
        actorId: user?.userId ?? '',
        at: new Date().toISOString(),
      });
      const result = addLineScan(lines, { lotCode, sku });
      if (result.ok) setLines(result.lines);
      setPendingScan(null);
      setFefoReason('');
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo registrar el escaneo'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScan(raw: string) {
    setError('');
    setDone('');
    if (!orderId || waitingTransfer) return;
    const parsed = parseScan(raw);
    if (!parsed.ok) {
      setError('Código ilegible');
      return;
    }
    let lot;
    try {
      lot = await backofficeApi.getLot(parsed.lotCode);
    } catch {
      setError(`Lote desconocido: ${parsed.lotCode}`);
      return;
    }
    if (lot.status !== 'AVAILABLE') {
      setError(`El lote ${parsed.lotCode} no está disponible`);
      return;
    }
    const check = addLineScan(lines, { lotCode: parsed.lotCode, sku: lot.sku });
    if (!check.ok) {
      setError(check.error === 'SKU_NOT_IN_LINES' ? 'Ese lote no es de este pedido' : 'Línea completa');
      return;
    }
    const stock = await backofficeApi.getStock().catch(() => []);
    const atLocation = stock.filter((s) => s.locationId === locationId && s.lotStatus === 'AVAILABLE');
    if (needsFefoReason(parsed.lotCode, atLocation) && !fefoReason.trim()) {
      setPendingScan({ lotCode: parsed.lotCode, sku: lot.sku });
      return;
    }
    await doPick(parsed.lotCode, lot.sku, fefoReason.trim() || undefined);
  }

  async function handleDispatch() {
    if (!orderId || !complete) return;
    // pickupLocationId is not in the 1.4.0 order types; until the contract exposes
    // it every dispatch goes out as a shipment from this location.
    const mode = dispatchMode({ fulfillmentLocationId: locationId });
    if (mode !== 'SHIP') return;
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.transitionOrder(orderId, 'DISPATCHED', { trackingNumber, courierName });
      setDone('Pedido despachado');
      setOrderId(null);
      setLines([]);
      setTrackingNumber('');
      setCourierName('');
      await reloadQueues();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo despachar el pedido'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnpick(lotCode: string) {
    if (!orderId) return;
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.unpickOrder(orderId, {
        unpickReferenceId: crypto.randomUUID(),
        lotCode,
        quantity: 1,
        actorId: user?.userId ?? '',
        at: new Date().toISOString(),
      });
      setLines((prev) => removeLineScan(prev, lotCode));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo quitar la unidad'));
    } finally {
      setSubmitting(false);
    }
  }

  const complete = isComplete(lines);

  return (
    <div className="space-y-6" data-testid="preparacion-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Preparación</h1>

      <LocationPicker value={locationId} onChange={setLocationId} />

      {locationId && (
        <>
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Por empezar</h2>
            {loading ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : confirmed.length === 0 ? (
              <p className="text-sm text-gray-400">Sin pedidos confirmados.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="preparacion-confirmed">
                {confirmed.map((o) => (
                  <div key={o.orderId} className="px-4 py-3 flex items-center justify-between">
                    <span className="font-mono text-sm font-medium text-brand-primary">{o.orderCode}</span>
                    <button onClick={() => handleStart(o.orderId)} disabled={submitting} className="text-sm text-brand-primary hover:underline disabled:opacity-50" data-testid={`preparacion-start-${o.orderId}`}>
                      Empezar preparación
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">En preparación</h2>
            {preparing.length === 0 && !loading ? (
              <p className="text-sm text-gray-400">Sin pedidos en preparación.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="preparacion-list">
                {preparing.map((o) => (
                  <button key={o.orderId} onClick={() => handleSelect(o.orderId)} className="w-full text-left px-4 py-3 hover:bg-gray-50" data-testid={`preparacion-order-${o.orderId}`}>
                    <span className="font-mono text-sm font-medium text-brand-primary">{o.orderCode}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {orderId && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="preparacion-panel">
              {waitingTransfer ? (
                <p className="text-sm text-amber-700" data-testid="preparacion-waiting">
                  Esperando traslado. No se puede preparar hasta recibirlo.
                </p>
              ) : (
                <>
                  <ScanInput onScan={handleScan} placeholder="Escanear bolsa..." />
                  <div className="space-y-2" data-testid="preparacion-lines">
                    {lines.map((l) => (
                      <div key={l.sku} className="p-2 bg-gray-50 rounded text-sm" data-testid={`preparacion-line-${l.sku}`}>
                        <span className="font-mono font-medium">{l.sku}</span>
                        <span className="text-gray-500"> · {l.lots.reduce((n, x) => n + x.quantity, 0)}/{l.quantity} u.</span>
                        {l.lots.map((x) => (
                          <span key={x.lotCode} className="ml-2 font-mono text-xs">
                            {x.lotCode} ×{x.quantity}
                            <button onClick={() => handleUnpick(x.lotCode)} disabled={submitting} className="ml-1 text-gray-400 hover:text-red-600 underline" data-testid={`preparacion-unpick-${x.lotCode}`}>
                              quitar una
                            </button>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                  {pendingScan && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2" data-testid="preparacion-fefo">
                      <p className="text-sm text-amber-800">Ese lote no es el que vence primero. Motivo obligatorio:</p>
                      <input type="text" value={fefoReason} onChange={(e) => setFefoReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" placeholder="Motivo..." data-testid="preparacion-fefo-reason" />
                      <button
                        onClick={() => { if (fefoReason.trim()) void doPick(pendingScan.lotCode, pendingScan.sku, fefoReason.trim()); }}
                        disabled={submitting || !fefoReason.trim()}
                        className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg disabled:opacity-50"
                        data-testid="preparacion-fefo-submit"
                      >
                        Confirmar con motivo
                      </button>
                    </div>
                  )}
                  {complete && (
                    <>
                      <p className="text-sm text-green-700" data-testid="preparacion-complete">Pedido completo. Completá el despacho:</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="dispatch-tracking" className="block text-sm font-medium text-gray-700 mb-1">Tracking</label>
                          <input id="dispatch-tracking" type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" data-testid="dispatch-tracking" />
                        </div>
                        <div>
                          <label htmlFor="dispatch-courier" className="block text-sm font-medium text-gray-700 mb-1">Courier</label>
                          <input id="dispatch-courier" type="text" value={courierName} onChange={(e) => setCourierName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="dispatch-courier" />
                        </div>
                      </div>
                      <button onClick={handleDispatch} disabled={submitting} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg disabled:opacity-50" data-testid="dispatch-submit">
                        {submitting ? 'Despachando...' : 'Marcar despachado'}
                      </button>
                    </>
                  )}
                </>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {done && <p className="text-sm text-green-700">{done}</p>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
