'use client';

import { useState } from 'react';
import { ReceptionForm } from '@/components/wms/reception-form';

export default function RecepcionesPage() {
  const [successMsg, setSuccessMsg] = useState('');

  function handleSuccess() {
    setSuccessMsg('Recepción registrada exitosamente');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  return (
    <div className="max-w-2xl space-y-6" data-testid="recepciones-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Recepción de Mercancía</h1>
      <p className="text-sm text-gray-500">Registra la recepción de productos contra una orden de compra.</p>

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" data-testid="reception-success">
          {successMsg}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <ReceptionForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
