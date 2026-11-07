import { describe, it, expect } from 'vitest';
import {
  validateHarvestForm,
  buildHarvestGeo,
  farmSelectState,
  toFarmOptions,
  NO_FARMS_MESSAGE,
  FARMS_LOAD_ERROR_MESSAGE,
} from './harvest';

const base = {
  farmId: 'finca-el-mirador',
  quality: 'MADURO' as const,
  harvester: 'Juan Perez',
  harvestedAt: '2026-11-01T06:00',
  cherryKg: '1.2',
};

describe('validateHarvestForm', () => {
  it('requires a farm', () => {
    expect(validateHarvestForm({ ...base, farmId: '' })).toBe('Elegí la finca');
  });

  it('requires a quality', () => {
    expect(validateHarvestForm({ ...base, quality: '' as '' | 'MADURO' | 'MIXTO' | 'VERDE' })).toBe('Elegí la calidad');
  });

  it('requires a harvester', () => {
    expect(validateHarvestForm({ ...base, harvester: '  ' })).toBe('Indicá quién cosechó');
  });

  it('requires a date', () => {
    expect(validateHarvestForm({ ...base, harvestedAt: '' })).toBe('Indicá la fecha de cosecha');
  });

  it('requires kilograms above zero with at most 3 decimals', () => {
    expect(validateHarvestForm({ ...base, cherryKg: '0' })).toBe('Los kilos deben ser un número mayor a 0 con hasta 3 decimales');
    expect(validateHarvestForm({ ...base, cherryKg: '-5' })).toBe('Los kilos deben ser un número mayor a 0 con hasta 3 decimales');
    expect(validateHarvestForm({ ...base, cherryKg: 'abc' })).toBe('Los kilos deben ser un número mayor a 0 con hasta 3 decimales');
    expect(validateHarvestForm({ ...base, cherryKg: '12.5005' })).toBe('Los kilos deben ser un número mayor a 0 con hasta 3 decimales');
    expect(validateHarvestForm({ ...base, cherryKg: '12.5' })).toBeNull();
  });

  it('accepts a valid form', () => {
    expect(validateHarvestForm(base)).toBeNull();
  });
});

describe('buildHarvestGeo', () => {
  it('returns coordinates only when both are present', () => {
    expect(buildHarvestGeo('4.71', '-75.68')).toEqual({ lat: 4.71, lon: -75.68 });
    expect(buildHarvestGeo('', '')).toBeUndefined();
    expect(buildHarvestGeo('4.71', '')).toBeUndefined();
    expect(buildHarvestGeo('', '-75.68')).toBeUndefined();
  });
});

describe('farmSelectState', () => {
  const farms = [{ farmId: 'finca-el-mirador' }];

  it('is loading while the farms request is in flight', () => {
    expect(farmSelectState({ loading: true, loadError: false, farms: [] })).toBe('loading');
    expect(farmSelectState({ loading: true, loadError: true, farms })).toBe('loading');
  });

  it('is error when the farms request fails', () => {
    expect(farmSelectState({ loading: false, loadError: true, farms: [] })).toBe('error');
    expect(farmSelectState({ loading: false, loadError: true, farms })).toBe('error');
  });

  it('is empty when the backend has no farms', () => {
    expect(farmSelectState({ loading: false, loadError: false, farms: [] })).toBe('empty');
  });

  it('is ready only with at least one farm', () => {
    expect(farmSelectState({ loading: false, loadError: false, farms })).toBe('ready');
    expect(
      farmSelectState({ loading: false, loadError: false, farms: [...farms, { farmId: 'otra' }] }),
    ).toBe('ready');
  });

  it('pins the user-facing copy', () => {
    expect(NO_FARMS_MESSAGE).toContain('No hay fincas registradas');
    expect(NO_FARMS_MESSAGE).toContain('FARM');
    expect(FARMS_LOAD_ERROR_MESSAGE).toContain('No se pudieron cargar las fincas');
  });
});

describe('toFarmOptions', () => {
  it('maps active FARM locations by code', () => {
    expect(toFarmOptions([{ code: 'F-ARM', active: true }])).toEqual([{ farmId: 'F-ARM' }]);
  });

  it('drops locations without code and inactive ones', () => {
    expect(
      toFarmOptions([
        { code: '', active: true },
        { active: true },
        { code: 'OLD', active: false },
        { code: 'F-ARM', active: true },
      ]),
    ).toEqual([{ farmId: 'F-ARM' }]);
  });

  it('returns empty when no location qualifies', () => {
    expect(toFarmOptions([])).toEqual([]);
  });
});
