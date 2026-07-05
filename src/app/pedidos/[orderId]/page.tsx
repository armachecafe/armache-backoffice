'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { staffApi, type AdminOrderDetail } from '@/lib/api';
import { OrderDetailAdmin } from '@/components/orders/order-detail-admin';

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    if (!params.orderId) return;
    setLoading(true);
    try {
      const data = await staffApi.getOrder(params.orderId);
      setOrder(data);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [params.orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  if (loading) {
    return <div className="space-y-4"><div className="h-8 w-48 bg-gray-100 rounded animate-pulse" /><div className="h-60 bg-gray-100 rounded-xl animate-pulse" /></div>;
  }

  if (!order) {
    return <div className="text-center py-12 text-gray-500">Pedido no encontrado</div>;
  }

  return (
    <div>
      <Link href="/pedidos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4" data-testid="order-detail-back">
        <ArrowLeft className="w-4 h-4" /> Pedidos
      </Link>
      <OrderDetailAdmin order={order} onUpdate={fetchOrder} />
    </div>
  );
}
