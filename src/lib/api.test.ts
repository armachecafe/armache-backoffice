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

describe('backofficeApi harvests (finca)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createHarvest POSTs the RegisterHarvestRequest and returns the direct result', async () => {
    const input = {
      harvestReferenceId: 'harv-001',
      farmId: 'finca-el-mirador',
      cherryKgGrams: 1200,
      quality: 'MADURO' as const,
      harvester: 'Juan Perez',
      harvestedAt: '2026-11-01T06:00:00.000Z',
    };
    const result = { success: true, harvestId: 'h-1', harvestReferenceId: 'harv-001' };
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => result });

    await expect(backofficeApi.createHarvest(input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/wms/harvests'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('listHarvests sends farmId plus date filters in the query string and unwraps items', async () => {
    const record = {
      harvestId: 'h-1',
      harvestReferenceId: 'harv-001',
      farmId: 'finca-el-mirador',
      cherryKgGrams: 1200,
      quality: 'MADURO',
      harvester: 'Juan Perez',
      harvestedAt: '2026-11-01T06:00:00.000Z',
      createdAt: '2026-11-01T07:00:00.000Z',
    };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [record] }) });

    await expect(
      backofficeApi.listHarvests({ farmId: 'finca-el-mirador', dateFrom: '2026-11-01', dateTo: '2026-11-05' }),
    ).resolves.toEqual([record]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/backoffice/wms/harvests?');
    expect(url).toContain('farmId=finca-el-mirador');
    expect(url).toContain('dateFrom=2026-11-01');
    expect(url).toContain('dateTo=2026-11-05');
  });

  it('listHarvestFarms GETs the farms endpoint and unwraps items', async () => {
    const farms = [{ farmId: 'finca-el-mirador' }, { farmId: 'finca-la-cumbre' }];
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: farms }) });

    await expect(backofficeApi.listHarvestFarms()).resolves.toEqual(farms);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/wms/harvests/farms'),
      expect.anything(),
    );
  });

  it('getHarvest GETs the harvest by id and returns the record', async () => {
    const record = {
      harvestId: 'h-1',
      harvestReferenceId: 'harv-001',
      farmId: 'finca-el-mirador',
      cherryKgGrams: 1200,
      quality: 'MADURO',
      harvester: 'Juan Perez',
      harvestedAt: '2026-11-01T06:00:00.000Z',
      createdAt: '2026-11-01T07:00:00.000Z',
    };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => record });

    await expect(backofficeApi.getHarvest('h-1')).resolves.toEqual(record);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/wms/harvests/h-1'),
      expect.anything(),
    );
  });
});

describe('backofficeApi inventory core (O1)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listLocations sends the role filter and unwraps items', async () => {
    const locations = [{ locationId: 'l-1', code: 'CD-NORTE', name: 'CD Norte', roles: ['DISTRIBUTION'], active: true }];
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: locations }) });

    await expect(backofficeApi.listLocations({ role: 'DISTRIBUTION' })).resolves.toEqual(locations);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/backoffice/locations?');
    expect(url).toContain('role=DISTRIBUTION');
  });

  it('createLocation POSTs the request and returns the location', async () => {
    const input = { code: 'CD-NORTE', name: 'CD Norte', roles: ['DISTRIBUTION' as 'DISTRIBUTION'], actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const location = { locationId: 'l-1', ...input, active: true };
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => location });

    await expect(backofficeApi.createLocation(input)).resolves.toEqual(location);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/locations'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('updateLocation PATCHes the location by id', async () => {
    const location = { locationId: 'l-1', code: 'CD-NORTE', name: 'CD Norte Nuevo', roles: ['DISTRIBUTION'], active: true };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => location });

    await expect(backofficeApi.updateLocation('l-1', { name: 'CD Norte Nuevo', actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' })).resolves.toEqual(location);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/locations/l-1'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'CD Norte Nuevo', actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' }) }),
    );
  });

  it('getStock GETs without query params and unwraps items', async () => {
    const rows = [{ locationId: 'l-1', sku: 'SKU-1', lotCode: 'LOT-A', lotStatus: 'AVAILABLE', onHand: 10, reserved: 0, allocated: 0, available: 10, bestBefore: '2026-12-01T00:00:00.000Z' }];
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: rows }) });

    await expect(backofficeApi.getStock()).resolves.toEqual(rows);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/backoffice/inventory/stock');
    expect(url).not.toContain('?');
  });

  it('listMovements GETs without query params and unwraps items', async () => {
    const movements = [{ movementId: 'm-1', type: 'IN', locationId: 'l-1', lotCode: 'LOT-A', quantity: 10, referenceId: 'ref-1', actorId: 'a-1', at: '2026-11-01T00:00:00.000Z', source: { kind: 'count', id: 'c-1' } }];
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: movements }) });

    await expect(backofficeApi.listMovements()).resolves.toEqual(movements);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/inventory/movements'),
      expect.anything(),
    );
  });

  it('getLot GETs the packaged lot by encoded code', async () => {
    const lot = { lotCode: 'LOT-A', sku: 'SKU-1', roastedAt: '2026-10-01T00:00:00.000Z', bestBefore: '2026-12-01T00:00:00.000Z', status: 'AVAILABLE' };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => lot });

    await expect(backofficeApi.getLot('LOT-A')).resolves.toEqual(lot);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/inventory/lots/LOT-A'),
      expect.anything(),
    );
  });

  it('createLot POSTs the packaged lot and returns it', async () => {
    const input = { lotReferenceId: 'lotref-1', lotCode: 'LOT-A', sku: 'SKU-1', roastedAt: '2026-10-01T00:00:00.000Z', bestBefore: '2026-12-01T00:00:00.000Z', locationId: 'l-1', initialQuantityGrams: 5000, actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const lot = { lotCode: 'LOT-A', sku: 'SKU-1', roastedAt: input.roastedAt, bestBefore: input.bestBefore, status: 'AVAILABLE' };
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => lot });

    await expect(backofficeApi.createLot(input)).resolves.toEqual(lot);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/inventory/lots'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('createCount POSTs the count and returns the result', async () => {
    const input = { countReferenceId: 'cnt-1', locationId: 'l-1', reason: 'conteo inicial', lines: [{ lotCode: 'LOT-A', countedQuantity: 10 }], actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const result = { success: true, countReferenceId: 'cnt-1' };
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => result });

    await expect(backofficeApi.createCount(input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/inventory/counts'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('createCount rejects with the status on conflict', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, statusText: 'Conflict', text: async () => '{"code":"CONFLICT"}' });

    await expect(backofficeApi.createCount({ countReferenceId: 'cnt-1', locationId: 'l-1', reason: 'x', lines: [], actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' })).rejects.toThrow('409');
  });
});

describe('backofficeApi inventory transfers (O1)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listInventoryTransfers sends the filters in the query string and unwraps items', async () => {
    const transfers = [{ transferId: 't-1', status: 'IN_TRANSIT', fromLocationId: 'l-1', toLocationId: 'l-2', lines: [] }];
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: transfers }) });

    await expect(
      backofficeApi.listInventoryTransfers({ fromLocationId: 'l-1', toLocationId: 'l-2', status: 'IN_TRANSIT', forOrderId: 'o-1' }),
    ).resolves.toEqual(transfers);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/backoffice/inventory/transfers?');
    expect(url).toContain('fromLocationId=l-1');
    expect(url).toContain('toLocationId=l-2');
    expect(url).toContain('status=IN_TRANSIT');
    expect(url).toContain('forOrderId=o-1');
  });

  it('createInventoryTransfer POSTs the request and returns the transfer', async () => {
    const input = { transferReferenceId: 'tr-1', fromLocationId: 'l-1', toLocationId: 'l-2', lines: [{ sku: 'SKU-1', quantity: 5, lots: [{ lotCode: 'LOT-A', shipped: 5 }] }], actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const transfer = { transferId: 't-1', status: 'IN_TRANSIT', fromLocationId: 'l-1', toLocationId: 'l-2', lines: input.lines };
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => transfer });

    await expect(backofficeApi.createInventoryTransfer(input)).resolves.toEqual(transfer);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/inventory/transfers'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('shipInventoryTransfer POSTs the scans to the ship endpoint', async () => {
    const input = { shipReferenceId: 'sh-1', scans: ['LOT-A', 'LOT-B'], actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const transfer = { transferId: 't-1', status: 'IN_TRANSIT', fromLocationId: 'l-1', toLocationId: 'l-2', lines: [] };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => transfer });

    await expect(backofficeApi.shipInventoryTransfer('t-1', input)).resolves.toEqual(transfer);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/inventory/transfers/t-1/ship'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('receiveInventoryTransfer POSTs the received lines to the receive endpoint', async () => {
    const input = { receiveReferenceId: 'rc-1', lines: [{ lotCode: 'LOT-A', receivedQuantity: 5 }], actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const transfer = { transferId: 't-1', status: 'RECEIVED', fromLocationId: 'l-1', toLocationId: 'l-2', lines: [] };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => transfer });

    await expect(backofficeApi.receiveInventoryTransfer('t-1', input)).resolves.toEqual(transfer);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/inventory/transfers/t-1/receive'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('receiveInventoryTransfer rejects with the status on conflict', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, statusText: 'Conflict', text: async () => '{"code":"CONFLICT"}' });

    await expect(
      backofficeApi.receiveInventoryTransfer('t-1', { receiveReferenceId: 'rc-1', lines: [], actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' }),
    ).rejects.toThrow('409');
  });
});

describe('backofficeApi fulfillment (O2)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getFulfillmentOptions GETs the options and unwraps them', async () => {
    const options = { options: [{ locationId: 'l-1', name: 'CD Norte', fullyAvailable: true, lines: [{ sku: 'SKU-1', requested: 2, available: 5 }] }] };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => options });

    await expect(backofficeApi.getFulfillmentOptions('o-1')).resolves.toEqual(options.options);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/orders/o-1/fulfillment-options'),
      expect.anything(),
    );
  });

  it('assignOrder POSTs the assignment and returns the result', async () => {
    const input = { fulfillmentLocationId: 'l-1', actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const result = { success: true, fulfillmentLocationId: 'l-1' };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => result });

    await expect(backofficeApi.assignOrder('o-1', input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/orders/o-1/assign'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('pickOrder POSTs the scans and returns the picked lots', async () => {
    const input = { pickReferenceId: 'p-1', scans: [{ lotCode: 'LOT-A', quantity: 2 }], actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const result = { success: true, picked: [{ lotCode: 'LOT-A', quantity: 2 }] };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => result });

    await expect(backofficeApi.pickOrder('o-1', input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/orders/o-1/pick'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('unpickOrder POSTs the lot and quantity to release', async () => {
    const input = { unpickReferenceId: 'u-1', lotCode: 'LOT-A', quantity: 1, actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });

    await expect(backofficeApi.unpickOrder('o-1', input)).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/orders/o-1/unpick'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('sendOrderToPickupStore POSTs and returns the transfer', async () => {
    const input = { sendReferenceId: 's-1', actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const result = { success: true, transferId: 't-9' };
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => result });

    await expect(backofficeApi.sendOrderToPickupStore('o-1', input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/orders/o-1/send-to-pickup-store'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('listOrders sends the O2 filters including assigned=false', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [], nextCursor: undefined }) });

    await backofficeApi.listOrders({ status: 'CONFIRMED', assigned: false, fulfillmentLocationId: 'l-1', pickupLocationId: 'l-2' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/backoffice/orders?');
    expect(url).toContain('assigned=false');
    expect(url).toContain('fulfillmentLocationId=l-1');
    expect(url).toContain('pickupLocationId=l-2');
  });

  it('listOrders without O2 filters builds the same URL as before', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [], nextCursor: undefined }) });

    await backofficeApi.listOrders({ status: 'CONFIRMED', pageSize: 20 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.armachecafe.com/backoffice/orders?status=CONFIRMED&pageSize=20');
  });

  it('assignOrder rejects with the status on conflict', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, statusText: 'Conflict', text: async () => '{"code":"CONFLICT"}' });

    await expect(
      backofficeApi.assignOrder('o-1', { fulfillmentLocationId: 'l-1', actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' }),
    ).rejects.toThrow('409');
  });
});

describe('backofficeApi traceability and recall (O3)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('setLotStatus POSTs the status change and returns the result', async () => {
    const input = { status: 'QUARANTINE' as const, reason: 'sospecha de humedad', actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' };
    const result = { success: true, lotCode: 'LOT-A', status: 'QUARANTINE', affectedLots: ['LOT-A', 'LOT-B'] };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => result });

    await expect(backofficeApi.setLotStatus('LOT-A', input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/inventory/lots/LOT-A/status'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('getLotRecall GETs the recall report by encoded lot code', async () => {
    const report = { lotCode: 'LOT-A', status: 'QUARANTINE', remainingByLocation: [{ locationId: 'l-1', lotCode: 'LOT-A', quantity: 5 }], affectedOrders: [] };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => report });

    await expect(backofficeApi.getLotRecall('LOT-A')).resolves.toEqual(report);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/backoffice/inventory/lots/LOT-A/recall'),
      expect.anything(),
    );
  });

  it('searchLots builds the same URL as before', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [] }) });

    await backofficeApi.searchLots('ABC');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.armachecafe.com/backoffice/traceability/lots?search=ABC');
  });

  it('setLotStatus rejects with the status on conflict', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, statusText: 'Conflict', text: async () => '{"code":"CONFLICT"}' });

    await expect(
      backofficeApi.setLotStatus('LOT-A', { status: 'QUARANTINE' as const, reason: 'x', actorId: 'a-1', at: '2026-11-01T00:00:00.000Z' }),
    ).rejects.toThrow('409');
  });

  it('getLotTraceability encodes the lot code in the URL', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ lot: {}, backward: [], forward: [] }) });

    await backofficeApi.getLotTraceability('LOT A/1');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/backoffice/traceability/lots/LOT%20A%2F1');
  });
});
