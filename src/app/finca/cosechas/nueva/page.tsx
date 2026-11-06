'use client';

import { useRouter } from 'next/navigation';
import { HarvestForm } from '@/components/wms/harvest-form';

export default function NuevaCosechaPage() {
  const router = useRouter();

  return (
    <div className="max-w-md mx-auto space-y-6" data-testid="nueva-cosecha-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Nueva Cosecha</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <HarvestForm onSuccess={() => router.push('/finca/cosechas')} />
      </div>
    </div>
  );
}
