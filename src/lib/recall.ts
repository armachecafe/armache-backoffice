import type { RecallReport, RecallRemainingStock } from './api';

export function recallTotals(recall: RecallReport): { unitsInStock: number; ordersAffected: number } {
  return {
    unitsInStock: recall.remainingByLocation.reduce((n: number, r: RecallRemainingStock) => n + r.quantity, 0),
    ordersAffected: recall.affectedOrders.length,
  };
}

/** Status changes always require a reason (audit trail). */
export function validateStatusChange(input: { status: string; reason: string }): string | null {
  if (!input.reason.trim()) return 'El motivo es obligatorio';
  return null;
}
