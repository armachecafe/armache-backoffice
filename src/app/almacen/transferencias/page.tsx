'use client';

import { useState } from 'react';
import { TransferForm } from '@/components/wms/transfer-form';

export default function TransferenciasPage() {
  const [successMsg, setSuccessMsg] = useState('');

  function handleSuccess() {
    setSuccessMsg('Transferencia creada exitosamente');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  return (
    <div className="max-w-2xl space-y-6" data-testid="transferencias-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Transferencias</h1>
      <p className="text-sm text-gray-500">Transfiere stock entre Planta de Producción y Almacén/Tienda.</p>

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" data-testid="transfer-success">
          {successMsg}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <TransferForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
