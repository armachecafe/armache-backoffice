import { describe, it, expect } from 'vitest';
import { dispatchMode } from './dispatch';

describe('dispatchMode', () => {
  it('ships when the order has no pickup store', () => {
    expect(dispatchMode({})).toBe('SHIP');
    expect(dispatchMode({ pickupLocationId: '' })).toBe('SHIP');
  });

  it('is ready in place when the pickup store is the fulfillment location', () => {
    expect(dispatchMode({ pickupLocationId: 'l-1', fulfillmentLocationId: 'l-1' })).toBe('READY_HERE');
  });

  it('sends to the pickup store otherwise', () => {
    expect(dispatchMode({ pickupLocationId: 'l-2', fulfillmentLocationId: 'l-1' })).toBe('SEND_TO_STORE');
    expect(dispatchMode({ pickupLocationId: 'l-2' })).toBe('SEND_TO_STORE');
  });
});
