'use client';

import { useEffect, useState } from 'react';
import { backofficeApi, type BackofficeOrderSummary, type FulfillmentOption, type FulfillmentOptionLine } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { coverage, validateAssign, shortfall, sourceCandidates } from '@/lib/assignment';
import { apiErrorMessage } from '@/lib/api-errors';

type Tab = 'unassigned' | 'assigned';

export default function AsignacionPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('unassigned');
  const [orders, setOrders] = useState<BackofficeOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [options, setOptions] = useState<FulfillmentOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [chosenId, setChosenId] = useState('');
  const [reason, setReason] = useState('');
  const [shortfallSource, setShortfallSource] = useState('');
  const [shortfallCandidates, setShortfallCandidates] = useState<string[]>([]);
  const [pendingTransferId, setPendingTransferId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    try {
      const result = await backofficeApi.listOrders({ status: 'CONFIRMED', assigned: tab === 'assigned', pageSize: 50 });
      setOrders(result.items);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelectedId(null);
    setOptions([]);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleSelect(orderId: string) {
    setSelectedId(orderId);
    setChosenId('');
    setReason('');
    setShortfallSource('');
    setShortfallCandidates([]);
    setPendingTransferId(null);
    setError('');
    setLoadingOptions(true);
    try {
      setOptions(await backofficeApi.getFulfillmentOptions(orderId));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar las opciones'));
      setOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  }

  const chosenOption = options.find((o) => o.locationId === chosenId) ?? null;
  const missingLines = chosenOption ? shortfall(chosenOption) : [];

  async function handleLoadCandidates() {
    if (!chosenOption) return;
    const rows = await backofficeApi.getStock().catch(() => []);
    setShortfallSource('');
    setShortfallCandidates(sourceCandidates(rows, missingLines, chosenOption.locationId));
  }

  async function handleCreateShortfallTransfer() {
    if (!selectedId || !chosenOption || !shortfallSource || missingLines.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const transfer = await backofficeApi.createInventoryTransfer({
        transferReferenceId: crypto.randomUUID(),
        fromLocationId: shortfallSource,
        toLocationId: chosenOption.locationId,
        forOrderId: selectedId,
        lines: missingLines.map((l) => ({ sku: l.sku, quantity: l.missing, lots: [] })),
        actorId: user?.userId ?? '',
        at: new Date().toISOString(),
      });
      setPendingTransferId(transfer.transferId);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo crear el traslado del faltante'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !chosenId) return;
    const validation = validateAssign({ alreadyAssigned: tab === 'assigned', reason });
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.assignOrder(selectedId, {
        fulfillmentLocationId: chosenId,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        actorId: user?.userId ?? '',
        at: new Date().toISOString(),
      });
      setSelectedId(null);
      setOptions([]);
      setChosenId('');
      setReason('');
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo asignar el pedido'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="asignacion-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Asignación de pedidos</h1>

      <div className="flex gap-2" role="tablist">
        <button onClick={() => setTab('unassigned')} className={`px-4 py-2 text-sm font-medium rounded-lg ${tab === 'unassigned' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600'}`} data-testid="asignacion-tab-unassigned">
          Por asignar
        </button>
        <button onClick={() => setTab('assigned')} className={`px-4 py-2 text-sm font-medium rounded-lg ${tab === 'assigned' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600'}`} data-testid="asignacion-tab-assigned">
          Asignados
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-400" data-testid="asignacion-empty">Sin pedidos en esta cola.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="asignacion-list">
          {orders.map((o) => (
            <button key={o.orderId} onClick={() => handleSelect(o.orderId)} className="w-full text-left px-4 py-3 hover:bg-gray-50" data-testid={`asignacion-order-${o.orderId}`}>
              <p className="font-mono text-sm font-medium text-brand-primary">{o.orderCode}</p>
              <p className="text-xs text-gray-500">{o.customerName ?? o.customerEmail ?? ''} · {(o.totalCents / 100).toFixed(2)}</p>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <form onSubmit={handleAssign} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="asignacion-panel">
          <h2 className="text-sm font-semibold text-gray-700">Asignar pedido</h2>
          {loadingOptions ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {options.map((opt) => {
                const cov = coverage(opt);
                return (
                  <label key={opt.locationId} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50" data-testid={`asignacion-option-${opt.locationId}`}>
                    <input type="radio" name="fulfillment-location" checked={chosenId === opt.locationId} onChange={() => { setChosenId(opt.locationId); setShortfallSource(''); setShortfallCandidates([]); }} />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{opt.name}</span>
                      <span className="block text-xs text-gray-500">
                        {cov === 'ALL' ? 'Cubre todo' : cov === 'PARTIAL' ? 'Cubre parte' : 'Sin stock'}
                        {' · '}
                        {opt.lines.map((l: FulfillmentOptionLine) => `${l.sku}: ${l.available}/${l.requested}`).join(', ')}
                      </span>
                    </span>
                  </label>
                );
              })}
              {options.length === 0 && <p className="text-sm text-gray-400">Sin ubicaciones candidatas.</p>}
            </div>
          )}

          {chosenOption && missingLines.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3" data-testid="asignacion-shortfall">
              <p className="text-sm text-amber-800">
                Faltante en {chosenOption.name}: {missingLines.map((l) => `${l.sku} ×${l.missing}`).join(', ')}
              </p>
              {pendingTransferId ? (
                <p className="text-sm text-amber-800" data-testid="asignacion-waiting-transfer">
                  Esperando traslado {pendingTransferId}
                </p>
              ) : shortfallCandidates.length === 0 ? (
                <button type="button" onClick={handleLoadCandidates} className="px-4 py-2 bg-white border border-amber-300 text-sm font-medium rounded-lg" data-testid="asignacion-find-source">
                  Buscar origen del faltante
                </button>
              ) : (
                <div className="flex gap-2">
                  <select value={shortfallSource} onChange={(e) => setShortfallSource(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" data-testid="asignacion-shortfall-source">
                    <option value="">Seleccionar origen...</option>
                    {shortfallCandidates.map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                  <button type="button" onClick={handleCreateShortfallTransfer} disabled={submitting || !shortfallSource} className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg disabled:opacity-50" data-testid="asignacion-shortfall-submit">
                    Crear traslado
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'assigned' && (
            <div>
              <label htmlFor="asignacion-reason" className="block text-sm font-medium text-gray-700 mb-1">Motivo del cambio (obligatorio)</label>
              <input id="asignacion-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="asignacion-reason" />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting || !chosenId} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="asignacion-submit">
            {submitting ? 'Asignando...' : tab === 'assigned' ? 'Reasignar' : 'Asignar'}
          </button>
        </form>
      )}
    </div>
  );
}
