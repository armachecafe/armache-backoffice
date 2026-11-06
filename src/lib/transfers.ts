export interface NewTransferLine {
  lotCode: string;
  quantity: number;
}

export interface NewTransferForm {
  fromLocationId: string;
  toLocationId: string;
  lines: NewTransferLine[];
}

/** Returns the first validation error, or null when the transfer can be created. */
export function validateNewTransfer(form: NewTransferForm): string | null {
  if (form.fromLocationId && form.fromLocationId === form.toLocationId) {
    return 'El origen y el destino no pueden ser iguales';
  }
  if (form.lines.length === 0) return 'Agregá al menos un lote';
  return null;
}

export interface ShippedLot {
  lotCode: string;
  shipped: number;
}

export interface ReceivedLine {
  lotCode: string;
  receivedQuantity: number;
}

/** Pre-fills the receive form with shipped quantities. */
export function buildReceiveLines(transfer: { lines: { lots: ShippedLot[] }[] }): ReceivedLine[] {
  return transfer.lines.flatMap((l) => l.lots.map((s) => ({ lotCode: s.lotCode, receivedQuantity: s.shipped })));
}

/** Lots received short (or not at all), with the missing quantity. */
export function receiveShortfall(received: ReceivedLine[], shipped: ShippedLot[]): { lotCode: string; missing: number }[] {
  const got = new Map(received.map((r) => [r.lotCode, r.receivedQuantity]));
  return shipped
    .map((s) => ({ lotCode: s.lotCode, missing: s.shipped - (got.get(s.lotCode) ?? 0) }))
    .filter((s) => s.missing > 0);
}
