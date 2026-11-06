export interface ParsedScan {
  ok: true;
  gtin?: string;
  lotCode: string;
  bestBefore?: string;
  quantity?: number;
}

export interface UnreadableScan {
  ok: false;
  error: 'UNREADABLE';
}

/**
 * Parses a GS1-128 scan in either representation: parenthesized (`(01)..(10)..`) as
 * printed for humans, or bare (`01..10..`, optionally GS-separated and with a `]C0`/`]C1`
 * symbology prefix) as keyboard-wedge scanners emit it. Returns UNREADABLE when no lot
 * (AI 10) is found. Unknown AIs are ignored. Matches what the backend ship endpoint accepts
 * (verified live: bare `10<lote>` works, unknown AIs are rejected server-side).
 */
export function parseScan(raw: string): ParsedScan | UnreadableScan {
  const normalized = raw.replace(/^]C[01]/, '');
  const fields: Record<string, string> = {};
  for (const segment of normalized.split('\u001D')) {
    let rest = segment.replace(/[\s\x00-\x1F\x7F]/g, '');
    if (!rest) continue;
    // Parenthesized groups first: (AI)data(AI)data...
    const groupRe = /\((\d{2,4})\)([^()]*)/g;
    let consumed = false;
    let gm: RegExpExecArray | null;
    while ((gm = groupRe.exec(rest)) !== null) {
      fields[gm[1]] = gm[2];
      consumed = true;
    }
    if (consumed) continue;
    // Bare AI prefixes. Fixed-length AIs take their chars; the rest is variable-length.
    while (rest.length >= 2) {
      const ai = rest.slice(0, 2);
      if (!/^\d{2}$/.test(ai)) return { ok: false, error: 'UNREADABLE' };
      const fixed: Record<string, number> = { '01': 14, '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6 };
      const knownVariable = ai === '10' || ai === '21' || ai === '30' || ai === '37';
      if (fixed[ai] === undefined && !knownVariable) break;
      const take = fixed[ai] ?? rest.length - 2;
      fields[ai] = rest.slice(2, 2 + take);
      rest = rest.slice(2 + take);
      if (rest.length > 0 && rest.length < 2) return { ok: false, error: 'UNREADABLE' };
    }
  }
  const lotCode = fields['10'] ?? '';
  if (!lotCode) return { ok: false, error: 'UNREADABLE' };
  const result: ParsedScan = { ok: true, lotCode };
  if (fields['01']) result.gtin = fields['01'];
  const bestBefore = fields['15'] ?? fields['17'];
  if (bestBefore && /^\d{6}$/.test(bestBefore)) {
    result.bestBefore = `20${bestBefore.slice(0, 2)}-${bestBefore.slice(2, 4)}-${bestBefore.slice(4, 6)}`;
  }
  if (fields['37'] && /^\d+$/.test(fields['37'])) result.quantity = parseInt(fields['37'], 10);
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
