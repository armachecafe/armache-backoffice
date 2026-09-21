import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
}));

import { normalizeUploadGrant } from './api';

describe('normalizeUploadGrant', () => {
  const baseGrant = {
    imageId: 'img-123',
    uploadUrl: 'https://s3.example.com/upload',
    expiresAt: 1234567890,
  };

  it('returns signedHeaders from wire headers when present', () => {
    const wire = { ...baseGrant, headers: { 'Content-Type': 'image/png' } };
    const result = normalizeUploadGrant(wire);
    expect(result.signedHeaders).toEqual({ 'Content-Type': 'image/png' });
    expect(result.expiresAt).toBe(1234567890);
    expect(result.imageId).toBe('img-123');
    expect(result.uploadUrl).toBe('https://s3.example.com/upload');
  });

  it('falls back to requiredHeaders when headers is absent', () => {
    const wire = { ...baseGrant, requiredHeaders: { 'x-amz-header': 'value' } };
    const result = normalizeUploadGrant(wire);
    expect(result.signedHeaders).toEqual({ 'x-amz-header': 'value' });
  });

  it('prefers requiredHeaders over headers when both are present', () => {
    const wire = {
      ...baseGrant,
      headers: { 'Content-Type': 'image/png' },
      requiredHeaders: { 'x-amz-header': 'value' },
    };
    const result = normalizeUploadGrant(wire);
    expect(result.signedHeaders).toEqual({ 'x-amz-header': 'value' });
  });

  it('throws when neither headers nor requiredHeaders are present', () => {
    const wire = { ...baseGrant };
    expect(() => normalizeUploadGrant(wire)).toThrow(
      'La autorización de carga no incluyó los headers requeridos',
    );
  });

  it('throws when headers object is empty', () => {
    const wire = { ...baseGrant, headers: {} };
    expect(() => normalizeUploadGrant(wire)).toThrow(
      'La autorización de carga no incluyó los headers requeridos',
    );
  });
});
