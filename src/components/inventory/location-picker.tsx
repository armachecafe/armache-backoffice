'use client';

import { useEffect, useState } from 'react';
import { backofficeApi, type Location } from '@/lib/api';
import { getCurrentLocationId, setCurrentLocationId, clearCurrentLocationId } from '@/lib/current-location';

interface LocationPickerProps {
  role?: string;
  value: string;
  onChange: (locationId: string) => void;
}

export function LocationPicker({ role, value, onChange }: LocationPickerProps) {
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    backofficeApi
      .listLocations(role ? { role } : undefined)
      .then((items) => {
        setLocations(items);
        const stored = getCurrentLocationId(window.localStorage);
        if (stored && items.some((l) => l.locationId === stored)) {
          if (stored !== value) onChange(stored);
        } else if (stored) {
          clearCurrentLocationId(window.localStorage);
          if (value) onChange('');
        }
      })
      .catch(() => setLocations([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function handleChange(locationId: string) {
    if (locationId) {
      setCurrentLocationId(window.localStorage, locationId);
    } else {
      clearCurrentLocationId(window.localStorage);
    }
    onChange(locationId);
  }

  return (
    <div data-testid="location-picker">
      <label htmlFor="location-picker-select" className="block text-sm font-medium text-gray-700 mb-1">
        Ubicación actual
      </label>
      <select
        id="location-picker-select"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        data-testid="location-picker-select"
      >
        <option value="">Seleccionar ubicación...</option>
        {locations.map((l) => (
          <option key={l.locationId} value={l.locationId}>
            {l.name} ({l.code})
          </option>
        ))}
      </select>
    </div>
  );
}
