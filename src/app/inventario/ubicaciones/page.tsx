'use client';

import { useEffect, useState } from 'react';
import { backofficeApi, type Location, type LocationRole } from '@/lib/api';
import { validateLocationForm } from '@/lib/locations';
import { apiErrorMessage } from '@/lib/api-errors';

const ALL_ROLES: LocationRole[] = ['FARM', 'BULK_STORAGE', 'PLANT', 'PACKED_STORAGE', 'DISTRIBUTION', 'STORE'];

const emptyForm = { code: '', name: '', roles: [] as string[], suppliedBy: '' };

export default function UbicacionesPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    try {
      setLocations(await backofficeApi.listLocations());
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function nameOf(locationId: string) {
    return locations.find((l) => l.locationId === locationId)?.name ?? locationId;
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function openEdit(location: Location) {
    setEditingId(location.locationId);
    setForm({
      code: location.code,
      name: location.name,
      roles: [...location.roles],
      suppliedBy: location.suppliedBy ?? '',
    });
    setError('');
    setShowForm(true);
  }

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateLocationForm(
      { locationId: editingId ?? undefined, ...form },
      locations.filter((l) => l.locationId !== editingId),
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = {
        code: form.code.trim(),
        name: form.name.trim(),
        roles: form.roles,
        ...(form.suppliedBy ? { suppliedBy: form.suppliedBy } : {}),
      };
      if (editingId) {
        await backofficeApi.updateLocation(editingId, { name: data.name, roles: data.roles as LocationRole[], suppliedBy: form.suppliedBy || undefined });
      } else {
        await backofficeApi.createLocation({ ...data, roles: data.roles as LocationRole[] });
      }
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar la ubicación'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="ubicaciones-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-gray-900">Ubicaciones</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90"
          data-testid="ubicaciones-new"
        >
          Nueva ubicación
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4" data-testid="ubicacion-form">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ubicacion-code" className="block text-sm font-medium text-gray-700 mb-1">Código</label>
              <input id="ubicacion-code" type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editingId} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" placeholder="Ej: CD-NORTE" data-testid="ubicacion-code" />
            </div>
            <div>
              <label htmlFor="ubicacion-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input id="ubicacion-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Ej: CD Norte" data-testid="ubicacion-name" />
            </div>
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">Roles</p>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm cursor-pointer">
                  <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} data-testid={`ubicacion-role-${role}`} />
                  {role}
                </label>
              ))}
            </div>
          </div>

          {form.roles.includes('STORE') && (
            <div>
              <label htmlFor="ubicacion-supplied-by" className="block text-sm font-medium text-gray-700 mb-1">Abastecida por</label>
              <select id="ubicacion-supplied-by" value={form.suppliedBy} onChange={(e) => setForm({ ...form, suppliedBy: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="ubicacion-supplied-by">
                <option value="">Seleccionar ubicación...</option>
                {locations
                  .filter((l) => l.locationId !== editingId)
                  .map((l) => (
                    <option key={l.locationId} value={l.locationId}>{l.name} ({l.code})</option>
                  ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="ubicacion-submit">
              {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear ubicación'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900" data-testid="ubicacion-cancel">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="ubicaciones-table">
          {locations.map((l) => (
            <div key={l.locationId} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{l.name} <span className="font-mono text-xs text-gray-400">{l.code}</span></p>
                <p className="text-xs text-gray-500">{l.roles.join(', ')}{l.suppliedBy ? ` · abastecida por ${nameOf(l.suppliedBy)}` : ''}{!l.active ? ' · inactiva' : ''}</p>
              </div>
              <button onClick={() => openEdit(l)} className="text-sm text-brand-primary hover:underline" data-testid={`ubicacion-edit-${l.locationId}`}>
                Editar
              </button>
            </div>
          ))}
          {locations.length === 0 && <p className="px-4 py-6 text-sm text-gray-400">Sin ubicaciones registradas.</p>}
        </div>
      )}
    </div>
  );
}
