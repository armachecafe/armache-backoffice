import { Suspense } from 'react';
import { EditarProductoClient } from './editar-producto-client';

// STATIC route (no dynamic segment). The productId travels as a query param (?id=...),
// read client-side via useSearchParams. This avoids the static-export limitation where
// a dynamic [productId] not prerendered by generateStaticParams can't be resolved and
// the router falls back to '/' → RootPage → /dashboard. A static path always matches a
// real prerendered file, and query strings are always read at runtime.
export default function EditarProductoPage() {
  return (
    <Suspense fallback={null}>
      <EditarProductoClient />
    </Suspense>
  );
}
