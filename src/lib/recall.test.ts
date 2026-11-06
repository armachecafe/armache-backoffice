import { describe, it, expect } from 'vitest';
import { recallTotals, validateStatusChange } from './recall';

describe('recallTotals', () => {
  it('sums remaining units and counts affected orders', () => {
    expect(
      recallTotals({
        lotCode: 'LOT-A',
        status: 'QUARANTINE',
        remainingByLocation: [
          { locationId: 'l-1', lotCode: 'LOT-A', quantity: 5 },
          { locationId: 'l-2', lotCode: 'LOT-A', quantity: 3 },
        ],
        affectedOrders: [
          { orderId: 'o-1', orderCode: 'OC-1' },
          { orderId: 'o-2', orderCode: 'OC-2' },
        ],
      }),
    ).toEqual({ unitsInStock: 8, ordersAffected: 2 });
  });
});

describe('validateStatusChange', () => {
  it('requires a reason', () => {
    expect(validateStatusChange({ status: 'QUARANTINE', reason: '  ' })).toBe('El motivo es obligatorio');
    expect(validateStatusChange({ status: 'QUARANTINE', reason: 'sospecha' })).toBeNull();
  });
});
