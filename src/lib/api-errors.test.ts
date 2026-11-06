import { describe, it, expect } from 'vitest';
import { apiErrorMessage } from './api-errors';

describe('apiErrorMessage', () => {
  it('maps VALIDATION_ERROR to Datos inválidos', () => {
    const err = new Error('API error: 400 Bad Request {"code":"VALIDATION_ERROR"}');
    expect(apiErrorMessage(err, 'fallback')).toBe('Datos inválidos');
  });

  it('maps NOT_FOUND to No encontrado', () => {
    const err = new Error('API error: 404 Not Found {"code":"NOT_FOUND"}');
    expect(apiErrorMessage(err, 'fallback')).toBe('No encontrado');
  });

  it('maps CONFLICT to Conflicto con el estado actual', () => {
    const err = new Error('API error: 409 Conflict {"code":"CONFLICT"}');
    expect(apiErrorMessage(err, 'fallback')).toBe('Conflicto con el estado actual');
  });

  it('appends the server message when present', () => {
    const err = new Error('API error: 409 Conflict {"code":"CONFLICT","message":"El lote no está disponible"}');
    expect(apiErrorMessage(err, 'fallback')).toBe('Conflicto con el estado actual: El lote no está disponible');
  });

  it('returns the fallback for unknown errors', () => {
    expect(apiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
    expect(apiErrorMessage('boom', 'fallback')).toBe('fallback');
    expect(apiErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
