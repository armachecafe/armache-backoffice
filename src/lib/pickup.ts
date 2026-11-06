export interface PickupOrder {
  status: string;
  readyForPickupAt?: string;
}

export function isReadyForPickup(order: PickupOrder): boolean {
  return order.status === 'DISPATCHED' && !!order.readyForPickupAt;
}

export interface LinkedTransfer {
  transferId: string;
  forOrderId?: string;
}

/** Only transfers linked to an order. */
export function orderTransfers<T extends LinkedTransfer>(transfers: T[]): T[] {
  return transfers.filter((t) => !!t.forOrderId);
}
