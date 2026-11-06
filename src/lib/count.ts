import type { CountRequest } from './api';

export interface CountInput {
  referenceId: string;
  locationId: string;
  reason: string;
  counts: Record<string, number>;
  actorId: string;
  at: string;
}

export type BuildCountResult =
  | { ok: true; request: CountRequest }
  | { ok: false; error: string };

export function buildCountRequest(input: CountInput): BuildCountResult {
  if (!input.reason.trim()) return { ok: false, error: 'El motivo es obligatorio' };
  for (const [lotCode, qty] of Object.entries(input.counts)) {
    if (!Number.isInteger(qty) || qty < 0) return { ok: false, error: `Cantidad inválida: ${lotCode}` };
  }
  const lines = Object.entries(input.counts)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([lotCode, countedQuantity]) => ({ lotCode, countedQuantity }));
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
