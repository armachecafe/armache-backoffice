import { Suspense } from 'react';
import { OrderDetailClient } from './order-detail-client';

// STATIC route (no dynamic segment). The orderId travels as a query param (?id=...),
// read client-side via useSearchParams. Avoids the static-export limitation where a
// dynamic [orderId] not prerendered by generateStaticParams can't be resolved and the
// router falls back to '/' → RootPage → /dashboard.
export default function OrderDetailPage() {
  return (
    <Suspense fallback={null}>
      <OrderDetailClient />
    </Suspense>
  );
}
