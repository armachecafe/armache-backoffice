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
