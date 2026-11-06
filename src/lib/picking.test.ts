import { describe, it, expect } from 'vitest';
import { pickLines, canStartPicking } from './picking';
import { needsFefoReason } from './scan-session';

describe('pickLines', () => {
  it('builds empty pick lines from order items', () => {
    expect(pickLines([{ sku: 'SKU-1', quantity: 2 }, { sku: 'SKU-2', quantity: 1 }])).toEqual([
      { sku: 'SKU-1', quantity: 2, lots: [] },
      { sku: 'SKU-2', quantity: 1, lots: [] },
    ]);
  });
});

describe('canStartPicking', () => {
  it('allows picking without open transfers', () => {
    expect(canStartPicking([])).toBe(true);
    expect(canStartPicking([{ status: 'RECEIVED' }, { status: 'CANCELLED' }])).toBe(true);
  });

  it('blocks picking with a requested or in-transit transfer', () => {
    expect(canStartPicking([{ status: 'REQUESTED' }])).toBe(false);
    expect(canStartPicking([{ status: 'IN_TRANSIT' }])).toBe(false);
  });
});

describe('fefo reason at picking', () => {
  it('requires a reason only when skipping FEFO', () => {
    const stock = [
      { lotCode: 'LOT-A', bestBefore: '2026-12-01', lotStatus: 'AVAILABLE' },
      { lotCode: 'LOT-B', bestBefore: '2026-10-01', lotStatus: 'AVAILABLE' },
    ];
    expect(needsFefoReason('LOT-A', stock)).toBe(true);
    expect(needsFefoReason('LOT-B', stock)).toBe(false);
  });
});
