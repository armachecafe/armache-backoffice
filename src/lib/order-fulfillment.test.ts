import { describe, it, expect } from 'vitest';
import { fulfillmentRows, type OrderDetailWithFulfillment } from './order-fulfillment';

describe('fulfillmentRows', () => {
  it('lists picked lots from the fulfillment, empty without it', () => {
    const order = {
      fulfillment: {
        orderId: 'o-1',
        fulfillmentLocationId: 'l-1',
        pickedLines: [
          { lotCode: 'LOT-A', quantity: 2 },
          { lotCode: 'LOT-B', quantity: 1 },
        ],
      },
    } as OrderDetailWithFulfillment;
    expect(fulfillmentRows(order)).toEqual([
      { lotCode: 'LOT-A', quantity: 2 },
      { lotCode: 'LOT-B', quantity: 1 },
    ]);
    expect(fulfillmentRows({} as OrderDetailWithFulfillment)).toEqual([]);
  });
});
