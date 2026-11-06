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

export interface ShortfallLine {
  sku: string;
  missing: number;
}

/** Lines of an option that are not fully covered. */
export function shortfall(option: FulfillmentOption): ShortfallLine[] {
  return option.lines
    .map((l) => ({ sku: l.sku, missing: l.requested - l.available }))
    .filter((l) => l.missing > 0);
}

export interface StockAvailability {
  locationId: string;
  sku: string;
  available: number;
}

/** Locations (excluding one) holding every shortfall line in full, sorted by id. */
export function sourceCandidates(
  stockRows: StockAvailability[],
  shortfallLines: ShortfallLine[],
  excludeLocationId: string,
): string[] {
  const byLocation = new Map<string, Map<string, number>>();
  for (const r of stockRows) {
    if (r.locationId === excludeLocationId) continue;
    if (!byLocation.has(r.locationId)) byLocation.set(r.locationId, new Map());
    const perSku = byLocation.get(r.locationId)!;
    perSku.set(r.sku, (perSku.get(r.sku) ?? 0) + r.available);
  }
  return [...byLocation.keys()]
    .filter((id) => shortfallLines.every((l) => (byLocation.get(id)!.get(l.sku) ?? 0) >= l.missing))
    .sort();
}
