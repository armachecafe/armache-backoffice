'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { backofficeApi, type BackofficeProduct } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ProductImageManager } from '@/components/catalog/product-image-manager';

export function EditarProductoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // productId comes from the query string (?id=...), read at runtime — reliable in static export.
  const productId = searchParams.get('id') ?? '';

  const [product, setProduct] = useState<BackofficeProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceCents, setPriceCents] = useState('');
  const [costCents, setCostCents] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!productId) return;
    backofficeApi.getProduct(productId)
      .then((p) => {
        setProduct(p);
        setName(p.name);
        setSlug(p.slug);
        setDescription(p.description ?? '');
        setCategoryId(p.categoryId);
        setPriceCents(String(p.priceCents / 100));
        setCostCents(p.costCents ? String(p.costCents / 100) : '');
        setLowStockThreshold(p.lowStockThreshold ? String(p.lowStockThreshold) : '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar producto'))
      .finally(() => setLoading(false));
  }, [productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !priceCents) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await backofficeApi.updateProduct(productId, {
        name,
        slug,
        description: description || undefined,
        categoryId,
        priceCents: Math.round(Number(priceCents) * 100),
        costCents: costCents ? Math.round(Number(costCents) * 100) : undefined,
        lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : undefined,
      });
      setSuccess('Producto actualizado correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar producto');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!product && error) {
    return (
      <div className="max-w-2xl space-y-6" data-testid="edit-product-error">
        <Link href="/catalogo/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Volver al catálogo
        </Link>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6" data-testid="editar-producto-page">
      <div className="flex items-center gap-3">
        <Link href="/catalogo/" className="text-gray-400 hover:text-gray-700" title="Volver">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-display font-bold text-gray-900">Editar Producto</h1>
      </div>

      {/* Product image manager */}
      {product && (
        <ProductImageManager
          productId={product.productId}
          productName={product.name}
          initialImages={product.images ?? []}
        />
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input id="edit-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="edit-product-name" />
        </div>
        <div>
          <label htmlFor="edit-slug" className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
          <input id="edit-slug" type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" data-testid="edit-product-slug" />
        </div>
        <div>
          <label htmlFor="edit-desc" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea id="edit-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="edit-product-description" />
        </div>
        <div>
          <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <input id="edit-category" type="text" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="ID de categoría" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="edit-product-category" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="edit-price" className="block text-sm font-medium text-gray-700 mb-1">Precio (S/) *</label>
            <input id="edit-price" type="number" step="0.01" min="0.01" required value={priceCents} onChange={(e) => setPriceCents(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="edit-product-price" />
          </div>
          <div>
            <label htmlFor="edit-cost" className="block text-sm font-medium text-gray-700 mb-1">Costo (S/)</label>
            <input id="edit-cost" type="number" step="0.01" min="0" value={costCents} onChange={(e) => setCostCents(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="edit-product-cost" />
          </div>
          <div>
            <label htmlFor="edit-threshold" className="block text-sm font-medium text-gray-700 mb-1">Umbral stock bajo</label>
            <input id="edit-threshold" type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="edit-product-threshold" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600" data-testid="edit-product-error">{error}</p>}
        {success && <p className="text-sm text-green-600" data-testid="edit-product-success">{success}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting || !name || !priceCents} className="flex-1 py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="edit-product-submit">
            {submitting ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button type="button" onClick={() => router.push('/catalogo/')} className="px-4 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
