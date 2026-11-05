import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
}));

import { normalizeUploadGrant, backofficeApi } from './api';

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

describe('backofficeApi.splitLot (T5d)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the SplitLotRequest to /backoffice/wms/lots/split and returns the direct result', async () => {
    const input = {
      splitReferenceId: 'split-001',
      parentLotId: 'lot-parent-1',
      parentQuantityGrams: 1000,
      children: [
        { lotCode: 'LOT-A', quantityGrams: 600 },
        { lotCode: 'LOT-B', quantityGrams: 350 },
      ],
      wasteGrams: 50,
      actorId: 'actor-1',
      at: '2026-01-01T00:00:00.000Z',
    };
    const result = { success: true, childLotIds: ['c1', 'c2'], childLotCodes: ['LOT-A', 'LOT-B'] };
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => result });

    await expect(backofficeApi.splitLot(input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/wms/lots/split'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
});

describe('backofficeApi.mergeLots (T5d)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the MergeLotsRequest to /backoffice/wms/lots/merge and returns the direct result', async () => {
    const input = {
      mergeReferenceId: 'merge-001',
      parents: [
        { lotId: 'lot-1', quantityGrams: 500 },
        { lotId: 'lot-2', quantityGrams: 500 },
      ],
      outputLotCode: 'LOT-OUT',
      outputQuantityGrams: 950,
      wasteGrams: 50,
      actorId: 'actor-1',
      at: '2026-01-01T00:00:00.000Z',
    };
    const result = { success: true, outputLotId: 'lot-out-1', outputLotCode: 'LOT-OUT' };
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => result });

    await expect(backofficeApi.mergeLots(input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/wms/lots/merge'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
});
