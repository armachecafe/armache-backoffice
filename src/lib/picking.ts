import type { PickLine } from './scan-session';

/** Builds empty pick lines from order items. */
export function pickLines(items: { sku: string; quantity: number }[]): PickLine[] {
  return items.map((i) => ({ sku: i.sku, quantity: i.quantity, lots: [] }));
}

const OPEN_TRANSFER = new Set(['REQUESTED', 'IN_TRANSIT']);

/** Picking can start only when no transfer linked to the order is open. */
export function canStartPicking(linkedTransfers: { status: string }[]): boolean {
  return !linkedTransfers.some((t) => OPEN_TRANSFER.has(t.status));
}
