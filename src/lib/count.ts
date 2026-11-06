import type { CountRequest } from './api';

export interface CountLineInput {
  lotCode: string;
  /** Bags counted (integer, from scans or typed). */
  bags: number;
  /** Grams per bag (integer, from the bag label). UI-side conversion to grams. */
  gramsPerBag: number;
}

export interface CountInput {
  referenceId: string;
  locationId: string;
  reason: string;
  lines: CountLineInput[];
  actorId: string;
  at: string;
}

export type BuildCountResult =
  | { ok: true; request: CountRequest }
  | { ok: false; error: string };

/**
 * Builds a count request in grams: countedQuantity = bags × gramsPerBag.
 * The backend ledger works in grams and does no per-SKU conversion, so the
 * operator provides the per-bag weight and the UI converts.
 */
export function buildCountRequest(input: CountInput): BuildCountResult {
  if (!input.reason.trim()) return { ok: false, error: 'El motivo es obligatorio' };
  for (const line of input.lines) {
    if (!Number.isInteger(line.bags) || line.bags < 0 || !Number.isInteger(line.gramsPerBag) || line.gramsPerBag <= 0) {
      return { ok: false, error: `Cantidad inválida: ${line.lotCode}` };
    }
  }
  const lines = [...input.lines]
    .sort((a, b) => (a.lotCode < b.lotCode ? -1 : a.lotCode > b.lotCode ? 1 : 0))
    .map((l) => ({ lotCode: l.lotCode, countedQuantity: l.bags * l.gramsPerBag }));
  return {
    ok: true,
    request: {
      countReferenceId: input.referenceId,
      locationId: input.locationId,
      reason: input.reason.trim(),
      lines,
      actorId: input.actorId,
      at: input.at,
    },
  };
}
