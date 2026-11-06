import { describe, it, expect } from 'vitest';
import { validateLocationForm } from './locations';

const base = {
  code: 'CD-NORTE',
  name: 'CD Norte',
  roles: ['DISTRIBUTION'],
  suppliedBy: '',
};

describe('validateLocationForm', () => {
  it('requires a code', () => {
    expect(validateLocationForm({ ...base, code: '  ' }, [])).toBe('El código es obligatorio');
  });

  it('requires a name', () => {
    expect(validateLocationForm({ ...base, name: '' }, [])).toBe('El nombre es obligatorio');
  });

  it('requires at least one role', () => {
    expect(validateLocationForm({ ...base, roles: [] }, [])).toBe('Elegí al menos un rol');
  });

  it('requires suppliedBy when the location is a store', () => {
    expect(validateLocationForm({ ...base, roles: ['STORE'], suppliedBy: '' }, [])).toBe(
      'La tienda necesita una ubicación que la abastezca',
    );
  });

  it('rejects suppliedBy pointing at itself', () => {
    expect(
      validateLocationForm({ ...base, locationId: 'l-1', suppliedBy: 'l-1' }, [{ locationId: 'l-1' }]),
    ).toBe('La ubicación no puede abastecerse a sí misma');
  });

  it('accepts a valid form', () => {
    expect(validateLocationForm(base, [])).toBeNull();
  });
});
