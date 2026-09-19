'use client';

import { useState } from 'react';
import { Package, MapPin, Truck, MessageSquare } from 'lucide-react';
import type { BackofficeOrderDetail, OrderStatus } from '@/lib/api';
import { backofficeApi } from '@/lib/api';
import { StateTransitionButton } from '@/components/orders/state-transition-button';
import { usePermissions } from '@/contexts/permissions-context';

interface OrderDetailAdminProps {
  order: BackofficeOrderDetail;
  onUpdate: () => void;
}

export function OrderDetailAdmin({ order, onUpdate }: OrderDetailAdminProps) {
  const { can } = usePermissions();
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const createdDate = new Date(order.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await backofficeApi.addOrderNote(order.orderId, noteText.trim());
      setNoteText('');
      onUpdate();
    } finally {
      setAddingNote(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="admin-order-detail">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{order.orderCode}</h2>
          <p className="text-sm text-gray-500">{createdDate}</p>
        </div>
        <StateTransitionButton orderId={order.orderId} currentStatus={order.status} onTransition={onUpdate} />
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Estado</h3>
        <ol className="space-y-2">
          {order.timeline.map((ev, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-brand-primary' : 'bg-gray-300'}`} />
              <span className="font-medium text-gray-900">{ev.status}</span>
              <span className="text-gray-400 text-xs">{new Date(ev.timestamp).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {ev.actor && <span className="text-gray-400 text-xs">por {ev.actor}</span>}
            </li>
          ))}
        </ol>
      </div>

      {/* Tracking */}
      {order.trackingNumber && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <Truck className="w-5 h-5 text-brand-primary" />
          <span className="text-sm">{order.courierName ?? 'Courier'}: <span className="font-mono">{order.trackingNumber}</span></span>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Items</h3>
        <div className="space-y-2">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.name} ×{item.quantity}</span>
              <span className="font-medium">S/ {(item.subtotalCents / 100).toFixed(2)}</span>
            </div>
          ))}
          <hr className="border-gray-100" />
          <div className="flex justify-between text-sm"><span>Envío</span><span>{order.shippingCents === 0 ? 'Gratis' : `S/ ${(order.shippingCents / 100).toFixed(2)}`}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>S/ {(order.totalCents / 100).toFixed(2)}</span></div>
        </div>
      </div>

      {/* Customer + Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Cliente</h3>
          <p className="text-sm text-gray-600">{order.customer.name}</p>
          <p className="text-sm text-gray-500">{order.customer.email}</p>
          {order.customer.phone && <p className="text-sm text-gray-500">{order.customer.phone}</p>}
        </div>
        {order.shippingAddress && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> Envío</h3>
            <p className="text-sm text-gray-600">{order.shippingAddress.recipientName}</p>
            <p className="text-sm text-gray-500">{order.shippingAddress.street}, {order.shippingAddress.city}</p>
            <p className="text-sm text-gray-500">{order.shippingAddress.department}, {order.shippingAddress.province}</p>
          </div>
        )}
      </div>

      {/* Notes */}
      {can('order:note:create') && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Notas internas</h3>
          {order.notes.map((note) => (
            <div key={note.noteId} className="mb-2 p-2 bg-gray-50 rounded text-sm">
              <p className="text-gray-800">{note.text}</p>
              <p className="text-xs text-gray-400 mt-1">{note.author} · {new Date(note.createdAt).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Agregar nota..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="order-note-input" />
            <button onClick={handleAddNote} disabled={addingNote || !noteText.trim()} className="px-4 py-2 bg-brand-primary text-white text-sm rounded-lg disabled:opacity-50" data-testid="order-note-submit">Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}
