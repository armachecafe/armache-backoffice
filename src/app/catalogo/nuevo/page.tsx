'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffApi } from '@/lib/api';

export default function NuevoProductoPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceCents, setPriceCents] = useState('');
  const [costCents, setCostCents] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleNameChange(val: string) {
    setName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !priceCents) return;
    setSubmitting(true);
    setError('');
    try {
      await staffApi.createProduct({
        name,
        slug,
        description: description || undefined,
        categoryId,
        priceCents: Math.round(Number(priceCents) * 100),
        costCents: costCents ? Math.round(Number(costCents) * 100) : undefined,
        lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : undefined,
      });
      router.push('/catalogo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear producto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6" data-testid="nuevo-producto-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Nuevo Producto</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="prod-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input id="prod-name" type="text" required value={name} onChange={(e) => handleNameChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="product-name" />
        </div>
        <div>
          <label htmlFor="prod-slug" className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
          <input id="prod-slug" type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" data-testid="product-slug" />
        </div>
        <div>
          <label htmlFor="prod-desc" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea id="prod-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="product-description" />
        </div>
        <div>
          <label htmlFor="prod-category" className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
          <input id="prod-category" type="text" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="ID de categoría" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="product-category" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="prod-price" className="block text-sm font-medium text-gray-700 mb-1">Precio (S/) *</label>
            <input id="prod-price" type="number" step="0.01" min="0.01" required value={priceCents} onChange={(e) => setPriceCents(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="product-price" />
          </div>
          <div>
            <label htmlFor="prod-cost" className="block text-sm font-medium text-gray-700 mb-1">Costo (S/)</label>
            <input id="prod-cost" type="number" step="0.01" min="0" value={costCents} onChange={(e) => setCostCents(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="product-cost" />
          </div>
          <div>
            <label htmlFor="prod-threshold" className="block text-sm font-medium text-gray-700 mb-1">Umbral stock bajo</label>
            <input id="prod-threshold" type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="product-threshold" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting || !name || !priceCents} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="product-submit">
          {submitting ? 'Creando...' : 'Crear Producto'}
        </button>
      </form>
    </div>
  );
}
