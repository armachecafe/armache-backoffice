'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { backofficeApi } from '@/lib/api';

export default function PedidoB2BPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [items, setItems] = useState([{ sku: '', productName: '', quantity: '', unitPrice: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function addItem() {
    setItems([...items, { sku: '', productName: '', quantity: '', unitPrice: '' }]);
  }

  function updateItem(idx: number, field: string, value: string) {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  }

  const totalCents = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Math.round((Number(item.unitPrice) || 0) * 100);
    return sum + qty * price;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName || !clientCompany || !contactEmail || items.every((i) => !i.sku)) return;
    setSubmitting(true);
    setError('');
    try {
      await backofficeApi.createB2BOrder({
        clientName,
        clientCompany,
        clientContact: { name: contactName || clientName, email: contactEmail, phone: contactPhone },
        items: items.filter((i) => i.sku && Number(i.quantity) > 0).map((i) => ({
          sku: i.sku,
          productName: i.productName || i.sku,
          quantity: Number(i.quantity),
          unitPrice: Math.round(Number(i.unitPrice) * 100),
        })),
        shippingAddress: null,
        shippingMethod: { type: 'PICKUP', pickupLocationId: 'SEDE_PRINCIPAL', pickupLocationName: 'Sede Principal', cost: 0 },
      });
      router.push('/pedidos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear pedido B2B');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6" data-testid="pedido-b2b-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Nuevo Pedido B2B</h1>
      <p className="text-sm text-gray-500">Crea un pedido coordinado por WhatsApp/teléfono. No requiere pasarela de pago.</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Client info */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-700">Cliente</legend>
          <input type="text" required placeholder="Nombre del cliente *" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="b2b-client-name" />
          <input type="text" required placeholder="Empresa *" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="b2b-client-company" />
          <div className="grid grid-cols-3 gap-3">
            <input type="text" placeholder="Contacto" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="b2b-contact-name" />
            <input type="email" required placeholder="Email *" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="b2b-contact-email" />
            <input type="tel" required placeholder="Teléfono *" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="b2b-contact-phone" />
          </div>
        </fieldset>

        {/* Items */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-700">Items</legend>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input type="text" placeholder="SKU" value={item.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} className="w-28 px-2 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`b2b-item-sku-${idx}`} />
              <input type="text" placeholder="Producto" value={item.productName} onChange={(e) => updateItem(idx, 'productName', e.target.value)} className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`b2b-item-name-${idx}`} />
              <input type="number" placeholder="Qty" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`b2b-item-qty-${idx}`} />
              <input type="number" step="0.01" placeholder="S/" min="0" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm" data-testid={`b2b-item-price-${idx}`} />
              {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-sm text-brand-primary hover:underline" data-testid="b2b-add-item">+ Agregar item</button>
          <p className="text-sm font-medium text-gray-700 text-right">Total: S/ {(totalCents / 100).toFixed(2)}</p>
        </fieldset>

        {error && <p className="text-sm text-red-600" data-testid="b2b-error">{error}</p>}

        <button type="submit" disabled={submitting || !clientName || !clientCompany || !contactEmail} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="b2b-submit">
          {submitting ? 'Creando...' : 'Crear Pedido B2B'}
        </button>
      </form>
    </div>
  );
}
