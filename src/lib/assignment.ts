import type { FulfillmentOption } from './api';

export type Coverage = 'ALL' | 'PARTIAL' | 'NONE';

export function coverage(option: FulfillmentOption): Coverage {
  if (option.fullyAvailable) return 'ALL';
  const anyAvailable = option.lines.some((l) => l.available > 0);
  return anyAvailable ? 'PARTIAL' : 'NONE';
}

/**
 * Preselects the pickup store when it is among the options. The contract does
 * not expose the order's pickup store yet (only as a list filter), so callers
 * pass undefined until it does — then manual selection applies.
 */
export function preselectLocation(
  pickupLocationId: string | undefined,
  options: FulfillmentOption[],
): string | null {
  if (!pickupLocationId) return null;
  return options.some((o) => o.locationId === pickupLocationId) ? pickupLocationId : null;
}

export function validateAssign(input: { alreadyAssigned: boolean; reason: string }): string | null {
  if (input.alreadyAssigned && !input.reason.trim()) return 'Indicá el motivo del cambio';
  return null;
}
