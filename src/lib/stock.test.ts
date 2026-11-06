import { describe, it, expect } from 'vitest';
import { sortStockFefo, lotStatusLabel } from './stock';
import type { StockRow } from './api';

function row(lotCode: string, bestBefore: string): StockRow {
  return {
    locationId: 'l-1', sku: 'SKU-1', lotCode, lotStatus: 'AVAILABLE',
    onHand: 10, reserved: 0, allocated: 0, available: 10, bestBefore,
  };
}

describe('sortStockFefo', () => {
  it('sorts by bestBefore ascending, breaking ties by lotCode', () => {
    const rows = [row('LOT-C', '2026-12-01T00:00:00.000Z'), row('LOT-B', '2026-11-01T00:00:00.000Z'), row('LOT-A', '2026-11-01T00:00:00.000Z')];
    expect(sortStockFefo(rows).map((r) => r.lotCode)).toEqual(['LOT-A', 'LOT-B', 'LOT-C']);
  });
});

describe('lotStatusLabel', () => {
  it('maps all statuses to Spanish', () => {
    expect(lotStatusLabel('AVAILABLE')).toBe('Disponible');
    expect(lotStatusLabel('QUARANTINE')).toBe('Cuarentena');
    expect(lotStatusLabel('BLOCKED')).toBe('Bloqueado');
    expect(lotStatusLabel('DEPLETED')).toBe('Agotado');
  });
});
