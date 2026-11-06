import { describe, it, expect } from 'vitest';
import { buildCountRequest } from './count';

describe('buildCountRequest', () => {
  it('requires a reason', () => {
    expect(
      buildCountRequest({ referenceId: 'cnt-1', locationId: 'l-1', reason: '  ', counts: { 'LOT-A': 1 }, actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' }),
    ).toEqual({ ok: false, error: 'El motivo es obligatorio' });
  });

  it('rejects invalid quantities', () => {
    expect(
      buildCountRequest({ referenceId: 'cnt-1', locationId: 'l-1', reason: 'conteo', counts: { 'LOT-A': -1 }, actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' }),
    ).toEqual({ ok: false, error: 'Cantidad inválida: LOT-A' });
    expect(
      buildCountRequest({ referenceId: 'cnt-1', locationId: 'l-1', reason: 'conteo', counts: { 'LOT-A': 1.5 }, actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' }),
    ).toEqual({ ok: false, error: 'Cantidad inválida: LOT-A' });
  });

  it('builds the request sorted by lot', () => {
    expect(
      buildCountRequest({
        referenceId: 'cnt-1', locationId: 'l-1', reason: 'conteo',
        counts: { 'LOT-B': 3, 'LOT-A': 0 }, actorId: 'a-1', at: '2026-11-01T00:00:00.000Z',
      }),
    ).toEqual({
      ok: true,
      request: {
        countReferenceId: 'cnt-1',
        locationId: 'l-1',
        reason: 'conteo',
        lines: [
          { lotCode: 'LOT-A', countedQuantity: 0 },
          { lotCode: 'LOT-B', countedQuantity: 3 },
        ],
        actorId: 'a-1',
        at: '2026-11-01T00:00:00.000Z',
      },
    });
  });
});
