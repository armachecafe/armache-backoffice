import type { BackofficeOrderDetail, OrderFulfillment } from './api';

/**
 * Order with optional fulfillment info. The 1.4.0 contract does not return
 * `fulfillment` on the order detail yet (gap reported to backend); the UI
 * renders the Despacho section only when it is present, so nothing changes
 * until then.
 */
export type OrderDetailWithFulfillment = BackofficeOrderDetail & {
  fulfillment?: OrderFulfillment;
};

export interface FulfillmentRow {
  lotCode: string;
  quantity: number;
}

/** Picked lots of the fulfillment, for the order detail section. */
export function fulfillmentRows(order: OrderDetailWithFulfillment): FulfillmentRow[] {
  return (order.fulfillment?.pickedLines ?? []).map((l) => ({ lotCode: l.lotCode, quantity: l.quantity }));
}
