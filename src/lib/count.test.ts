import { describe, it, expect } from 'vitest';
import { buildCountRequest } from './count';

const base = {
  referenceId: 'cnt-1',
  locationId: 'l-1',
  reason: 'conteo',
  actorId: 'a-1',
  at: '2026-11-01T00:00:00.000Z',
};

describe('buildCountRequest', () => {
  it('requires a reason', () => {
    expect(buildCountRequest({ ...base, reason: '  ', lines: [{ lotCode: 'LOT-A', bags: 1, gramsPerBag: 250 }] })).toEqual({
      ok: false,
      error: 'El motivo es obligatorio',
    });
  });

  it('rejects invalid bags or grams', () => {
    expect(
      buildCountRequest({ ...base, lines: [{ lotCode: 'LOT-A', bags: -1, gramsPerBag: 250 }] }),
    ).toEqual({ ok: false, error: 'Cantidad inválida: LOT-A' });
    expect(
      buildCountRequest({ ...base, lines: [{ lotCode: 'LOT-A', bags: 1, gramsPerBag: 0 }] }),
    ).toEqual({ ok: false, error: 'Cantidad inválida: LOT-A' });
  });

  it('converts bags to grams and sorts by lot', () => {
    expect(
      buildCountRequest({
        ...base,
        lines: [
          { lotCode: 'LOT-B', bags: 3, gramsPerBag: 250 },
          { lotCode: 'LOT-A', bags: 2, gramsPerBag: 500 },
        ],
      }),
    ).toEqual({
      ok: true,
      request: {
        countReferenceId: 'cnt-1',
        locationId: 'l-1',
        reason: 'conteo',
        lines: [
          { lotCode: 'LOT-A', countedQuantity: 1000 },
          { lotCode: 'LOT-B', countedQuantity: 750 },
        ],
        actorId: 'a-1',
        at: '2026-11-01T00:00:00.000Z',
      },
    });
  });
});
