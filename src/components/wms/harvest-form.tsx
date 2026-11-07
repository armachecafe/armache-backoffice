'use client';

import { useState, useEffect } from 'react';
import { backofficeApi } from '@/lib/api';
import { farmSelectState, toFarmOptions, isKgAmount, NO_FARMS_MESSAGE, FARMS_LOAD_ERROR_MESSAGE } from '@/lib/harvest';

interface HarvestFormProps {
  onSuccess: () => void;
}

export function HarvestForm({ onSuccess }: HarvestFormProps) {
  const [farms, setFarms] = useState<{ farmId: string }[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(true);
  const [farmsError, setFarmsError] = useState(false);
  const [farmId, setFarmId] = useState('');
  const [cherryKg, setCherryKg] = useState('');
  const [quality, setQuality] = useState<'MADURO' | 'MIXTO' | 'VERDE' | ''>('');
  const [harvester, setHarvester] = useState('');
  const [harvestedAt, setHarvestedAt] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFarmsLoading(true);
    setFarmsError(false);
    backofficeApi
      .listLocations({ role: 'FARM' })
      .then((locs) => setFarms(toFarmOptions(locs)))
      .catch(() => setFarmsError(true))
      .finally(() => setFarmsLoading(false));
  }, []);

  const farmsState = farmSelectState({ loading: farmsLoading, loadError: farmsError, farms });

  const kg = Number(cherryKg);
  const valid =
    farmId !== '' &&
    quality !== '' &&
    harvester.trim() !== '' &&
    harvestedAt !== '' &&
    isKgAmount(kg);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const farmGeo = lat !== '' && lon !== '' ? { lat: Number(lat), lon: Number(lon) } : undefined;
      await backofficeApi.createHarvest({
        harvestReferenceId: crypto.randomUUID(),
        farmId,
        ...(farmGeo ? { farmGeo } : {}),
        cherryKg: kg,
        quality: quality as 'MADURO' | 'MIXTO' | 'VERDE',
        harvester: harvester.trim(),
        harvestedAt: new Date(harvestedAt).toISOString(),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la cosecha');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="harvest-form">
      <div>
        <label htmlFor="harvest-farm" className="block text-sm font-medium text-gray-700 mb-1">Finca</label>
        <select id="harvest-farm" value={farmId} onChange={(e) => setFarmId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="harvest-farm-select">
          <option value="">Seleccionar finca...</option>
          {farms.map((f) => (
            <option key={f.farmId} value={f.farmId}>{f.farmId}</option>
          ))}
        </select>
        {farmsState === 'empty' && (
          <p className="mt-1 text-sm text-amber-700" data-testid="harvest-no-farms">{NO_FARMS_MESSAGE}</p>
        )}
        {farmsState === 'error' && (
          <p className="mt-1 text-sm text-red-600" data-testid="harvest-farms-error">{FARMS_LOAD_ERROR_MESSAGE}</p>
        )}
      </div>

      <div>
        <label htmlFor="harvest-kg" className="block text-sm font-medium text-gray-700 mb-1">Cereza (kg)</label>
        <input id="harvest-kg" type="number" min="0.001" step="0.001" value={cherryKg} onChange={(e) => setCherryKg(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: 12.5" data-testid="harvest-kg" />
      </div>

      <div>
        <label htmlFor="harvest-quality" className="block text-sm font-medium text-gray-700 mb-1">Calidad</label>
        <select id="harvest-quality" value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="harvest-quality">
          <option value="">Seleccionar calidad...</option>
          <option value="MADURO">MADURO</option>
          <option value="MIXTO">MIXTO</option>
          <option value="VERDE">VERDE</option>
        </select>
      </div>

      <div>
        <label htmlFor="harvest-harvester" className="block text-sm font-medium text-gray-700 mb-1">Cosechador</label>
        <input id="harvest-harvester" type="text" value={harvester} onChange={(e) => setHarvester(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Nombre de quien cosechó" data-testid="harvest-harvester" />
      </div>

      <div>
        <label htmlFor="harvest-harvested-at" className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de cosecha</label>
        <input id="harvest-harvested-at" type="datetime-local" value={harvestedAt} onChange={(e) => setHarvestedAt(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="harvest-harvested-at" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="harvest-lat" className="block text-sm font-medium text-gray-700 mb-1">Latitud (opcional)</label>
          <input id="harvest-lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: 4.71" data-testid="harvest-lat" />
        </div>
        <div>
          <label htmlFor="harvest-lon" className="block text-sm font-medium text-gray-700 mb-1">Longitud (opcional)</label>
          <input id="harvest-lon" type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: -75.68" data-testid="harvest-lon" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting || !valid} className="w-full py-2.5 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="harvest-submit">
        {submitting ? 'Registrando...' : 'Registrar Cosecha'}
      </button>
    </form>
  );
}
