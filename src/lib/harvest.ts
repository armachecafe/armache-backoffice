export type HarvestQuality = 'MADURO' | 'MIXTO' | 'VERDE';

export interface HarvestFormValues {
  farmId: string;
  quality: HarvestQuality | '';
  harvester: string;
  harvestedAt: string;
  cherryKg?: string;
  cherryKgGrams?: string;
}

/** Exact kg validation: positive number with at most 3 decimals (resolution 1 g). */
export function isKgAmount(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
  const scaled = value * 1000;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Returns the first validation error, or null when the form can be submitted. */
export function validateHarvestForm(form: HarvestFormValues): string | null {
  if (!form.farmId) return 'Elegí la finca';
  if (!form.quality) return 'Elegí la calidad';
  if (form.harvester.trim() === '') return 'Indicá quién cosechó';
  if (!form.harvestedAt) return 'Indicá la fecha de cosecha';
  const raw = form.cherryKg ?? form.cherryKgGrams;
  if (!raw || raw.trim() === '') return 'Los kilos deben ser un número mayor a 0 con hasta 3 decimales';
  const kg = Number(raw);
  if (!isKgAmount(kg)) return 'Los kilos deben ser un número mayor a 0 con hasta 3 decimales';
  return null;
}

/** Coordinates are sent only when both are present; otherwise the harvest has no geo. */
export function buildHarvestGeo(lat: string, lon: string): { lat: number; lon: number } | undefined {
  if (lat === '' || lon === '') return undefined;
  return { lat: Number(lat), lon: Number(lon) };
}

export interface FarmOption {
  farmId: string;
}

/** Visible state of the farm combo: loading → error beats empty → ready. */
export type FarmSelectState = 'loading' | 'error' | 'empty' | 'ready';

export function farmSelectState(input: {
  loading: boolean;
  loadError: boolean;
  farms: FarmOption[];
}): FarmSelectState {
  if (input.loading) return 'loading';
  if (input.loadError) return 'error';
  if (input.farms.length === 0) return 'empty';
  return 'ready';
}

/** Shown when no FARM location exists: the form cannot be submitted. */
export const NO_FARMS_MESSAGE =
  'No hay fincas registradas. Pedí que den de alta una finca (rol FARM en Ubicaciones) para habilitar esta lista.';

/** Shown when the farms request itself fails. */
export const FARMS_LOAD_ERROR_MESSAGE =
  'No se pudieron cargar las fincas. Revisá la conexión e intentá de nuevo.';

/** Farm master = Location with FARM role (S3). The combo uses the location
 * code as farmId, so harvests stay linked by free text without a new endpoint. */
export function toFarmOptions(locations: { code?: string; active?: boolean }[]): FarmOption[] {
  return locations
    .filter((l) => typeof l.code === 'string' && l.code !== '' && l.active !== false)
    .map((l) => ({ farmId: l.code as string }));
}
