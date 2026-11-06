import { describe, it, expect } from 'vitest';
import { coverage, preselectLocation, validateAssign } from './assignment';
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
