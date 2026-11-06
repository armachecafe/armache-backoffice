import { describe, it, expect } from 'vitest';
import { isReadyForPickup, orderTransfers } from './pickup';

describe('isReadyForPickup', () => {
  it('is ready when dispatched with readyForPickupAt', () => {
    expect(isReadyForPickup({ status: 'DISPATCHED', readyForPickupAt: '2026-11-01T00:00:00.000Z' })).toBe(true);
  });

  it('is not ready otherwise', () => {
    expect(isReadyForPickup({ status: 'DISPATCHED' })).toBe(false);
    expect(isReadyForPickup({ status: 'PREPARING', readyForPickupAt: '2026-11-01T00:00:00.000Z' })).toBe(false);
  });
});

describe('orderTransfers', () => {
  const transfers = [
    { transferId: 't-1', forOrderId: 'o-1' },
    { transferId: 't-2' },
  ];

  it('keeps only transfers linked to an order', () => {
    expect(orderTransfers(transfers)).toEqual([{ transferId: 't-1', forOrderId: 'o-1' }]);
  });
});
