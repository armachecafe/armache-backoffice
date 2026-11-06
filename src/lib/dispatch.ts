export type DispatchMode = 'SHIP' | 'READY_HERE' | 'SEND_TO_STORE';

/**
 * How a picked order leaves. pickupLocationId is not in the 1.4.0 order types,
 * so callers pass undefined until the contract exposes it (then SHIP-only today
 * becomes mode-aware with no signature change).
 */
export function dispatchMode(order: { pickupLocationId?: string; fulfillmentLocationId?: string }): DispatchMode {
  if (!order.pickupLocationId) return 'SHIP';
  if (order.pickupLocationId === order.fulfillmentLocationId) return 'READY_HERE';
  return 'SEND_TO_STORE';
}
