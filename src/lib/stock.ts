import type { StockRow, PackagedLotStatus } from './api';

const STATUS_LABELS: Record<PackagedLotStatus, string> = {
  AVAILABLE: 'Disponible',
  QUARANTINE: 'Cuarentena',
  BLOCKED: 'Bloqueado',
  DEPLETED: 'Agotado',
};

export function lotStatusLabel(status: PackagedLotStatus): string {
  return STATUS_LABELS[status];
}

/** FEFO order: earliest bestBefore first, ties broken by lotCode. */
export function sortStockFefo(rows: StockRow[]): StockRow[] {
  return [...rows].sort((a, b) => {
    if (a.bestBefore !== b.bestBefore) return a.bestBefore < b.bestBefore ? -1 : 1;
    return a.lotCode < b.lotCode ? -1 : a.lotCode > b.lotCode ? 1 : 0;
  });
}
