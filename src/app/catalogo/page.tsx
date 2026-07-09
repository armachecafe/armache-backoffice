'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, EyeOff, Pencil } from 'lucide-react';
import { staffApi, type AdminProduct } from '@/lib/api';

export default function CatalogoAdminPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  function fetchProducts(searchTerm?: string) {
    setLoading(true);
    staffApi.listProducts({ search: searchTerm || undefined, pageSize: 50 })
      .then((r) => setProducts(r.items))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchProducts(); }, []);

  async function handleUnpublish(productId: string) {
    if (!confirm('¿Despublicar este producto? Ya no será visible en la tienda.')) return;
    await staffApi.unpublishProduct(productId);
    fetchProducts(search);
  }

  return (
    <div className="space-y-6" data-testid="catalogo-admin-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-gray-900">Catálogo</h1>
        <Link href="/catalogo/nuevo" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90" data-testid="catalogo-new-button">
          <Plus className="w-4 h-4" /> Nuevo Producto
        </Link>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <input type="text" placeholder="Buscar por nombre o SKU..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchProducts(search)} className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="catalogo-search" />
        <button onClick={() => fetchProducts(search)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200" data-testid="catalogo-search-button">Buscar</button>
      </div>

      {/* Products table */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Producto</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">SKU</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Precio</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-gray-200" />}
                      <span className="font-medium text-gray-900 truncate max-w-[200px]">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden sm:table-cell">{p.sku}</td>
                  <td className="px-4 py-3 text-right font-medium">S/ {(p.priceCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    {p.published ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><Eye className="w-3 h-3" /> Público</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"><EyeOff className="w-3 h-3" /> Oculto</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Static route + query param (?id=): reliable in static export.
                          A dynamic [productId] route can't be resolved for non-prerendered ids
                          (falls back to '/' → RootPage → /dashboard). */}
                      <Link href={`/catalogo/editar/?id=${p.productId}`} className="text-gray-400 hover:text-brand-primary" title="Editar" data-testid={`catalogo-edit-${p.productId}`}><Pencil className="w-4 h-4" /></Link>
                      {p.published && (
                        <button onClick={() => handleUnpublish(p.productId)} className="text-gray-400 hover:text-red-600" title="Despublicar" data-testid={`catalogo-unpublish-${p.productId}`}><EyeOff className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin productos</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
