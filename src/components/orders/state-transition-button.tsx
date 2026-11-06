'use client';

import { useState } from 'react';
import type { OrderStatus } from '@/lib/api';
import { backofficeApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-errors';
import { usePermissions } from '@/contexts/permissions-context';

interface StateTransitionButtonProps {
  orderId: string;
  currentStatus: OrderStatus;
  onTransition: (newStatus: OrderStatus) => void;
  /** Pickup orders dispatch from Preparación, not here. Defaults to false (shipping). */
  isPickup?: boolean;
}

const transitions: Record<string, { next: OrderStatus; label: string; permission: string }> = {
  CONFIRMED: { next: 'PREPARING', label: 'Marcar en preparación', permission: 'order:transition' },
  PREPARING: { next: 'DISPATCHED', label: 'Marcar despachado', permission: 'order:transition' },
  DISPATCHED: { next: 'DELIVERED', label: 'Marcar entregado', permission: 'order:transition' },
};

export function StateTransitionButton({ orderId, currentStatus, onTransition, isPickup = false }: StateTransitionButtonProps) {
  const { can } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('');
  const [showTracking, setShowTracking] = useState(false);
  const [error, setError] = useState('');

  const transition = transitions[currentStatus];
  if (!transition || !can(transition.permission)) return null;
  if (isPickup && currentStatus === 'PREPARING') return null;

  async function handleTransition() {
    setLoading(true);
    setError('');
    try {
      const data = currentStatus === 'PREPARING' ? { trackingNumber, courierName } : undefined;
      await backofficeApi.transitionOrder(orderId, transition.next, data);
      onTransition(transition.next);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cambiar el estado'));
    } finally {
      setLoading(false);
      setShowTracking(false);
    }
  }

  // If transitioning to DISPATCHED, show tracking input first
  if (currentStatus === 'PREPARING' && !showTracking) {
    return (
      <button
        onClick={() => setShowTracking(true)}
        className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50"
        disabled={loading}
        data-testid="order-transition-button"
      >
        {transition.label}
      </button>
    );
  }

  if (currentStatus === 'PREPARING' && showTracking) {
    return (
      <div className="space-y-2" data-testid="order-tracking-form">
        <input
          type="text"
          placeholder="Número de seguimiento"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          data-testid="order-tracking-number"
        />
        <input
          type="text"
          placeholder="Courier (ej. Olva, Shalom)"
          value={courierName}
          onChange={(e) => setCourierName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          data-testid="order-courier-name"
        />
        <button
          onClick={handleTransition}
          disabled={loading}
          className="w-full px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50"
          data-testid="order-confirm-dispatch"
        >
          {loading ? 'Procesando...' : 'Confirmar despacho'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <>
    <button
      onClick={handleTransition}
      disabled={loading}
      className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50"
      data-testid="order-transition-button"
    >
      {loading ? 'Procesando...' : transition.label}
    </button>
    {error && currentStatus !== 'PREPARING' && <p className="text-sm text-red-600">{error}</p>}
    </>
  );
}
