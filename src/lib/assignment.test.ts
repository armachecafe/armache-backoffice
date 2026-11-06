import { describe, it, expect } from 'vitest';
import { coverage, preselectLocation, validateAssign, shortfall, sourceCandidates } from './assignment';
import type { FulfillmentOption } from './api';

function option(overrides: Partial<FulfillmentOption>): FulfillmentOption {
  return { locationId: 'l-1', name: 'CD Norte', fullyAvailable: false, lines: [], ...overrides };
}

describe('coverage', () => {
  it('is ALL when fully available', () => {
    expect(coverage(option({ fullyAvailable: true }))).toBe('ALL');
  });

  it('is PARTIAL when some line has stock', () => {
    expect(
      coverage(option({ lines: [{ sku: 'SKU-1', requested: 2, available: 1 }, { sku: 'SKU-2', requested: 1, available: 0 }] })),
    ).toBe('PARTIAL');
  });

  it('is NONE when no line has stock', () => {
    expect(coverage(option({ lines: [{ sku: 'SKU-1', requested: 2, available: 0 }] }))).toBe('NONE');
  });
});

describe('preselectLocation', () => {
  const options = [option({ locationId: 'l-1' }), option({ locationId: 'l-2' })];

  it('preselects the pickup store when it is an option', () => {
    expect(preselectLocation('l-2', options)).toBe('l-2');
  });

  it('returns null when the pickup store is not an option', () => {
    expect(preselectLocation('l-9', options)).toBeNull();
    expect(preselectLocation(undefined, options)).toBeNull();
  });
});

describe('validateAssign', () => {
  it('requires a reason to reassign', () => {
    expect(validateAssign({ alreadyAssigned: true, reason: '' })).toBe('Indicá el motivo del cambio');
    expect(validateAssign({ alreadyAssigned: true, reason: 'x' })).toBeNull();
    expect(validateAssign({ alreadyAssigned: false, reason: '' })).toBeNull();
  });
});

describe('shortfall', () => {
  it('returns lines missing stock', () => {
    const opt = option({ lines: [{ sku: 'SKU-1', requested: 3, available: 1 }, { sku: 'SKU-2', requested: 2, available: 2 }] });
    expect(shortfall(opt)).toEqual([{ sku: 'SKU-1', missing: 2 }]);
  });
});

describe('sourceCandidates', () => {
  const rows = [
    { locationId: 'l-2', sku: 'SKU-1', available: 5 },
    { locationId: 'l-3', sku: 'SKU-1', available: 1 },
  ];
  const missing = [{ sku: 'SKU-1', missing: 2 }];

  it('lists locations covering the whole shortfall, excluding one', () => {
    expect(sourceCandidates(rows, missing, 'l-1')).toEqual(['l-2']);
  });

  it('returns empty when nothing covers it', () => {
    expect(sourceCandidates(rows, [{ sku: 'SKU-1', missing: 9 }], 'l-1')).toEqual([]);
  });
});
