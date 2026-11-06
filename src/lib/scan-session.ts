export interface ParsedScan {
  ok: true;
  gtin: string;
  lotCode: string;
  bestBefore?: string;
  quantity?: number;
}

export interface UnreadableScan {
  ok: false;
  error: 'UNREADABLE';
}

/**
 * Parses a GS1-128 code like `(01)07701234567898(10)LOT-A(15)261201(37)5`.
 * Unknown AIs are ignored. Returns UNREADABLE without GTIN or lot.
 */
export function parseScan(raw: string): ParsedScan | UnreadableScan {
  const clean = raw.replace(/[\s\x00-\x1F\x7F]/g, '');
  if (!clean) return { ok: false, error: 'UNREADABLE' };
  const fields: Record<string, string> = {};
  const re = /\((\d{2,4})\)([^()]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    fields[m[1]] = m[2];
  }
  const gtin = fields['01'] ?? '';
  const lotCode = fields['10'] ?? '';
  if (!gtin || !lotCode) return { ok: false, error: 'UNREADABLE' };
  const result: ParsedScan = { ok: true, gtin, lotCode };
  if (fields['15'] && /^\d{6}$/.test(fields['15'])) {
    result.bestBefore = `20${fields['15'].slice(0, 2)}-${fields['15'].slice(2, 4)}-${fields['15'].slice(4, 6)}`;
  }
  if (fields['37'] && /^\d+$/.test(fields['37'])) {
    result.quantity = parseInt(fields['37'], 10);
  }
  return result;
}

export interface PickLot {
  lotCode: string;
  quantity: number;
}

export interface PickLine {
  sku: string;
  quantity: number;
  lots: PickLot[];
}

export type AddLineResult =
  | { ok: true; lines: PickLine[] }
  | { ok: false; error: 'SKU_NOT_IN_LINES' | 'LINE_COMPLETE' };

export function allocated(line: PickLine): number {
  return line.lots.reduce((sum, l) => sum + l.quantity, 0);
}

export function addCountScan(counts: Record<string, number>, lotCode: string): Record<string, number> {
  return { ...counts, [lotCode]: (counts[lotCode] ?? 0) + 1 };
}

export function addLineScan(lines: PickLine[], scan: { lotCode: string; sku: string }): AddLineResult {
  const idx = lines.findIndex((l) => l.sku === scan.sku);
  if (idx < 0) return { ok: false, error: 'SKU_NOT_IN_LINES' };
  const line = lines[idx];
  if (allocated(line) >= line.quantity) return { ok: false, error: 'LINE_COMPLETE' };
  const lotIdx = line.lots.findIndex((l) => l.lotCode === scan.lotCode);
  const lots =
    lotIdx < 0
      ? [...line.lots, { lotCode: scan.lotCode, quantity: 1 }]
      : line.lots.map((l, i) => (i === lotIdx ? { ...l, quantity: l.quantity + 1 } : l));
  return { ok: true, lines: lines.map((l, i) => (i === idx ? { ...l, lots } : l)) };
}

export function removeLineScan(lines: PickLine[], lotCode: string): PickLine[] {
  return lines.map((line) => {
    const lot = line.lots.find((l) => l.lotCode === lotCode);
    if (!lot) return line;
    if (lot.quantity <= 1) return { ...line, lots: line.lots.filter((l) => l.lotCode !== lotCode) };
    return { ...line, lots: line.lots.map((l) => (l.lotCode === lotCode ? { ...l, quantity: l.quantity - 1 } : l)) };
  });
}

export function isComplete(lines: PickLine[]): boolean {
  return lines.length > 0 && lines.every((l) => allocated(l) >= l.quantity);
}

export interface StockForFefo {
  lotCode: string;
  bestBefore: string;
  lotStatus: string;
}

/** Returns the available lot that expires first, if it is not the scanned one. */
export function fefoWarning(scannedLot: string, stock: StockForFefo[]): string | null {
  const scanned = stock.find((s) => s.lotCode === scannedLot);
  if (!scanned) return null;
  const earlier = stock
    .filter((s) => s.lotStatus === 'AVAILABLE' && s.lotCode !== scannedLot && s.bestBefore < scanned.bestBefore)
    .sort((a, b) => (a.bestBefore < b.bestBefore ? -1 : a.bestBefore > b.bestBefore ? 1 : 0))[0];
  return earlier ? earlier.lotCode : null;
}

export function needsFefoReason(scannedLot: string, stock: StockForFefo[]): boolean {
  return fefoWarning(scannedLot, stock) !== null;
}
