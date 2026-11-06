export interface LocationForm {
  locationId?: string;
  code: string;
  name: string;
  roles: string[];
  suppliedBy?: string;
}

export interface LocationOption {
  locationId: string;
}

/**
 * Returns the first validation error for a location form, or null when valid.
 * `others` lists the locations that can supply this one (already excluding none;
 * self-supply is rejected by comparing ids).
 */
export function validateLocationForm(form: LocationForm, others: LocationOption[]): string | null {
  if (!form.code.trim()) return 'El código es obligatorio';
  if (!form.name.trim()) return 'El nombre es obligatorio';
  if (form.roles.length === 0) return 'Elegí al menos un rol';
  if (form.roles.includes('STORE') && !form.suppliedBy) {
    return 'La tienda necesita una ubicación que la abastezca';
  }
  if (form.suppliedBy && form.locationId && form.suppliedBy === form.locationId) {
    return 'La ubicación no puede abastecerse a sí misma';
  }
  return null;
}
