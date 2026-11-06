import { describe, it, expect } from 'vitest';
import { validateNewTransfer } from './transfers';

describe('validateNewTransfer', () => {
  it('rejects same origin and destination', () => {
    expect(
      validateNewTransfer({ fromLocationId: 'l-1', toLocationId: 'l-1', lines: [{ lotCode: 'LOT-A', quantity: 1 }] }),
    ).toBe('El origen y el destino no pueden ser iguales');
  });

  it('requires at least one line', () => {
    expect(validateNewTransfer({ fromLocationId: 'l-1', toLocationId: 'l-2', lines: [] })).toBe(
      'Agregá al menos un lote',
    );
  });

  it('accepts a valid transfer', () => {
    expect(
      validateNewTransfer({ fromLocationId: 'l-1', toLocationId: 'l-2', lines: [{ lotCode: 'LOT-A', quantity: 2 }] }),
    ).toBeNull();
  });
});
