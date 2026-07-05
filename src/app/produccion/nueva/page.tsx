'use client';

import { useRouter } from 'next/navigation';
import { NewOrderForm } from '@/components/mes/new-order-form';

export default function NuevaOrdenPage() {
  const router = useRouter();

  return (
    <div className="max-w-md mx-auto space-y-6" data-testid="nueva-orden-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Nueva Orden de Producción</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <NewOrderForm onSuccess={() => router.push('/produccion')} />
      </div>
    </div>
  );
}
