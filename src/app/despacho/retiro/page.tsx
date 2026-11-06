'use client';

import { useEffect, useState } from 'react';
import { backofficeApi, type InventoryTransfer, type BackofficeOrderSummary } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { LocationPicker } from '@/components/inventory/location-picker';
import { ScanInput } from '@/components/inventory/scan-input';
import { parseScan } from '@/lib/scan-session';
import { buildReceiveLines, receiveShortfall, type ReceivedLine } from '@/lib/transfers';
import { orderTransfers } from '@/lib/pickup';
import { apiErrorMessage } from '@/lib/api-errors';

export default function RetiroPage() {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState('');
  const [incoming, setIncoming] = useState<InventoryTransfer[]>([]);
  const [ready, setReady] = useState<BackofficeOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [receiveTransfer, setReceiveTransfer] = useState<InventoryTransfer | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceivedLine[]>([]);
  const [seenLots, setSeenLots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function reload() {
    if (!locationId) return;
    setLoading(true);
    try {
      const [to, orders] = await Promise.all([
        backofficeApi.listInventoryTransfers({ toLocationId: locationId, status: 'IN_TRANSIT' }).catch(() => [] as InventoryTransfer[]),
        backofficeApi.listOrders({ pickupLocationId: locationId, status: 'DISPATCHED', pageSize: 50 }).catch(() => ({ items: [] as BackofficeOrderSummary[] })),
      ]);
      setIncoming(orderTransfers(to));
      // readyForPickupAt is not in the 1.4.0 order types; the server only moves a
      // pickup order to DISPATCHED when it is ready, so DISPATCHED here means ready.
      setReady(orders.items.filter((o) => o.status === 'DISPATCHED'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setReceiveTransfer(null);
    setReady([]);
    setIncoming([]);
    if (locationId) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  function openReceive(t: InventoryTransfer) {
    setReceiveTransfer(t);
    setReceiveLines(buildReceiveLines(t));
    setSeenLots([]);
    setError('');
    setDone('');
  }

  function handleScan(raw: string) {
    const parsed = parseScan(raw);
    if (parsed.ok) setSeenLots((s) => (s.includes(parsed.lotCode) ? s : [...s, parsed.lotCode]));
  }

  const shortfall = receiveTransfer
    ? receiveShortfall(receiveLines, receiveTransfer.lines.flatMap((l) => l.lots))
    : [];

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
      setDone('Traslado recibido. El pedido queda listo para retiro.');
      setReceiveTransfer(null);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo recibir el traslado'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeliver(orderId: string) {
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.transitionOrder(orderId, 'DELIVERED');
      setDone('Pedido entregado');
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo marcar la entrega'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="retiro-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Retiro en tienda</h1>

      <LocationPicker role="STORE" value={locationId} onChange={setLocationId} />

      {locationId && (
        <>
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Por recibir</h2>
            {loading ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : incoming.length === 0 ? (
              <p className="text-sm text-gray-400" data-testid="retiro-in-empty">Sin traslados por recibir.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="retiro-in">
                {incoming.map((t) => (
                  <div key={t.transferId} className="px-4 py-3 flex items-center justify-between">
                    <span className="font-mono text-sm font-medium text-brand-primary">{t.transferId}</span>
                    <button onClick={() => openReceive(t)} className="text-sm text-brand-primary hover:underline" data-testid={`retiro-receive-${t.transferId}`}>
                      Recibir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {receiveTransfer && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="retiro-receive-panel">
              <h3 className="text-sm font-semibold text-gray-700">Recibir {receiveTransfer.transferId}</h3>
              <ScanInput onScan={handleScan} placeholder="Escanear bolsa recibida..." />
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
                      className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                      data-testid={`retiro-qty-${l.lotCode}`}
                    />
                  </div>
                ))}
              </div>
              {shortfall.length > 0 && (
                <p className="text-sm text-amber-700" data-testid="retiro-shortfall">
                  Se registrará merma en tránsito: {shortfall.map((s) => `${s.lotCode} −${s.missing}`).join(', ')}
                </p>
              )}
              <button onClick={handleReceiveConfirm} disabled={submitting} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg disabled:opacity-50" data-testid="retiro-receive-submit">
                {submitting ? 'Recibiendo...' : 'Confirmar recepción'}
              </button>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Listos para retiro</h2>
            {ready.length === 0 && !loading ? (
              <p className="text-sm text-gray-400" data-testid="retiro-empty">Sin pedidos listos para retiro.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="retiro-ready">
                {ready.map((o) => (
                  <div key={o.orderId} className="px-4 py-3 flex items-center justify-between">
                    <span className="font-mono text-sm font-medium text-brand-primary">{o.orderCode}</span>
                    <button onClick={() => handleDeliver(o.orderId)} disabled={submitting} className="text-sm text-brand-primary hover:underline disabled:opacity-50" data-testid={`retiro-deliver-${o.orderId}`}>
                      Entregar al cliente
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && <p className="text-sm text-green-700">{done}</p>}
        </>
      )}
    </div>
  );
}
