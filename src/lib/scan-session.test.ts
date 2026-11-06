import { describe, it, expect } from 'vitest';
import {
  parseScan,
  addCountScan,
  addLineScan,
  removeLineScan,
  isComplete,
  fefoWarning,
  needsFefoReason,
  type PickLine,
} from './scan-session';

describe('parseScan (GS1-128)', () => {
  it('parses GTIN, lot, best-before and quantity', () => {
    expect(parseScan('(01)07701234567898(10)LOT-A(15)261201(37)5')).toEqual({
      ok: true,
      gtin: '07701234567898',
      lotCode: 'LOT-A',
      bestBefore: '2026-12-01',
      quantity: 5,
    });
  });

  it('ignores unknown AIs', () => {
    const parsed = parseScan('(01)07701234567898(99)XYZ(10)LOT-A');
    expect(parsed).toMatchObject({ ok: true, gtin: '07701234567898', lotCode: 'LOT-A' });
  });

  it('rejects codes without a lot', () => {
    expect(parseScan('(01)07701234567898')).toEqual({ ok: false, error: 'UNREADABLE' });
    expect(parseScan('   ')).toEqual({ ok: false, error: 'UNREADABLE' });
  });

  it('parses bare AI prefixes without parentheses', () => {
    expect(parseScan('010770123456789810TEST-LOT-E2E-01')).toEqual({
      ok: true,
      gtin: '07701234567898',
      lotCode: 'TEST-LOT-E2E-01',
    });
  });

  it('parses GS-separated segments and strips the symbology identifier', () => {
    expect(parseScan(']C10107701234567898GS10LOT-GS'.replace('GS', '\u001D'))).toEqual({
      ok: true,
      gtin: '07701234567898',
      lotCode: 'LOT-GS',
    });
  });

  it('accepts scans without GTIN when the lot is present', () => {
    expect(parseScan('10LOT-NOGTIN')).toEqual({ ok: true, gtin: undefined, lotCode: 'LOT-NOGTIN' });
  });
});

describe('count and pick lines', () => {
  it('addCountScan sums per lot', () => {
    expect(addCountScan({}, 'LOT-A')).toEqual({ 'LOT-A': 1 });
    expect(addCountScan({ 'LOT-A': 2 }, 'LOT-A')).toEqual({ 'LOT-A': 3 });
  });

  it('addLineScan allocates to the matching SKU line', () => {
    const lines: PickLine[] = [{ sku: 'SKU-1', quantity: 2, lots: [] }];
    const result = addLineScan(lines, { lotCode: 'LOT-A', sku: 'SKU-1' });
    expect(result).toEqual({ ok: true, lines: [{ sku: 'SKU-1', quantity: 2, lots: [{ lotCode: 'LOT-A', quantity: 1 }] }] });
  });

  it('addLineScan rejects SKUs outside the lines', () => {
    const lines: PickLine[] = [{ sku: 'SKU-1', quantity: 1, lots: [] }];
    expect(addLineScan(lines, { lotCode: 'LOT-A', sku: 'SKU-9' })).toEqual({ ok: false, error: 'SKU_NOT_IN_LINES' });
  });

  it('addLineScan rejects completed lines', () => {
    const lines: PickLine[] = [{ sku: 'SKU-1', quantity: 1, lots: [{ lotCode: 'LOT-A', quantity: 1 }] }];
    expect(addLineScan(lines, { lotCode: 'LOT-B', sku: 'SKU-1' })).toEqual({ ok: false, error: 'LINE_COMPLETE' });
  });

  it('removeLineScan decrements and drops empty lots', () => {
    const lines: PickLine[] = [{ sku: 'SKU-1', quantity: 2, lots: [{ lotCode: 'LOT-A', quantity: 2 }] }];
    expect(removeLineScan(lines, 'LOT-A')).toEqual([{ sku: 'SKU-1', quantity: 2, lots: [{ lotCode: 'LOT-A', quantity: 1 }] }]);
    expect(removeLineScan([{ sku: 'SKU-1', quantity: 1, lots: [{ lotCode: 'LOT-A', quantity: 1 }] }], 'LOT-A')).toEqual([
      { sku: 'SKU-1', quantity: 1, lots: [] },
    ]);
  });

  it('isComplete detects complete and incomplete lines', () => {
    expect(isComplete([{ sku: 'SKU-1', quantity: 1, lots: [{ lotCode: 'LOT-A', quantity: 1 }] }])).toBe(true);
    expect(isComplete([{ sku: 'SKU-1', quantity: 2, lots: [{ lotCode: 'LOT-A', quantity: 1 }] }])).toBe(false);
    expect(isComplete([])).toBe(false);
  });

  it('needsFefoReason when another available lot expires first', () => {
    const stock = [
      { lotCode: 'LOT-A', bestBefore: '2026-12-01', lotStatus: 'AVAILABLE' as const },
      { lotCode: 'LOT-B', bestBefore: '2026-10-01', lotStatus: 'AVAILABLE' as const },
    ];
    expect(fefoWarning('LOT-A', stock)).toBe('LOT-B');
    expect(needsFefoReason('LOT-A', stock)).toBe(true);
    expect(needsFefoReason('LOT-B', stock)).toBe(false);
  });
});
