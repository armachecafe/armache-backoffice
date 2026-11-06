import { describe, it, expect } from 'vitest';
import { validateNewTransfer, buildReceiveLines, receiveShortfall } from './transfers';

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

describe('buildReceiveLines', () => {
  it('proposes shipped quantities as received', () => {
    const transfer = {
      transferId: 't-1',
      lines: [{ sku: 'SKU-1', quantity: 5, lots: [{ lotCode: 'LOT-A', shipped: 3 }, { lotCode: 'LOT-B', shipped: 2 }] }],
    };
    expect(buildReceiveLines(transfer)).toEqual([
      { lotCode: 'LOT-A', receivedQuantity: 3 },
      { lotCode: 'LOT-B', receivedQuantity: 2 },
    ]);
  });
});

describe('receiveShortfall', () => {
  it('returns no missing lots when fully received', () => {
    expect(receiveShortfall([{ lotCode: 'LOT-A', receivedQuantity: 3 }], [{ lotCode: 'LOT-A', shipped: 3 }])).toEqual([]);
  });

  it('returns lots received short', () => {
    expect(
      receiveShortfall(
        [{ lotCode: 'LOT-A', receivedQuantity: 1 }],
        [{ lotCode: 'LOT-A', shipped: 3 }, { lotCode: 'LOT-B', shipped: 2 }],
      ),
    ).toEqual([
      { lotCode: 'LOT-A', missing: 2 },
      { lotCode: 'LOT-B', missing: 2 },
    ]);
  });
});
