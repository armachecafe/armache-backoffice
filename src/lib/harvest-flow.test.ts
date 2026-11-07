import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
}));

import { backofficeApi } from './api';
import { validateHarvestForm, buildHarvestGeo } from './harvest';
import { buildCountRequest } from './count';
import { coverage, shortfall, sourceCandidates, validateAssign } from './assignment';
import { pickLines, canStartPicking } from './picking';
import { dispatchMode } from './dispatch';
import { validateNewTransfer, buildReceiveLines, receiveShortfall } from './transfers';
import { addLineScan, isComplete, fefoWarning, needsFefoReason } from './scan-session';

const AT = '2026-11-01T00:00:00.000Z';

describe('harvest creation coverage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects invalid cherry grams before calling the API', () => {
    const base = {
      farmId: 'finca-el-mirador',
      quality: 'MADURO' as const,
      harvester: 'Juan Perez',
      harvestedAt: '2026-11-01T06:00',
    };
    expect(validateHarvestForm({ ...base, cherryKg: '-5' })).toBe(
      'Los kilos deben ser un número mayor a 0 con hasta 3 decimales',
    );
    expect(validateHarvestForm({ ...base, cherryKg: '' })).toBe(
      'Los kilos deben ser un número mayor a 0 con hasta 3 decimales',
    );
    expect(validateHarvestForm({ ...base, cherryKg: '12.5005' })).toBe(
      'Los kilos deben ser un número mayor a 0 con hasta 3 decimales',
    );
    // MIXTO y VERDE son válidos igual que MADURO.
    expect(
      validateHarvestForm({ ...base, quality: 'MIXTO', cherryKg: '1.2' }),
    ).toBeNull();
    expect(
      validateHarvestForm({ ...base, quality: 'VERDE', cherryKg: '1.2' }),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createHarvest rejects with the status on validation error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => '{"code":"VALIDATION_ERROR"}',
    });

    await expect(
      backofficeApi.createHarvest({
        harvestReferenceId: 'harv-bad',
        farmId: '',
        cherryKg: 0,
        quality: 'MADURO',
        harvester: '',
        harvestedAt: AT,
      }),
    ).rejects.toThrow('400');
  });

  it('getHarvest rejects with the status when the harvest does not exist', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '{"code":"NOT_FOUND"}',
    });

    await expect(backofficeApi.getHarvest('missing')).rejects.toThrow('404');
  });
});

describe('harvest to distribution flow (mocked)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers a harvest, counts it in a CD, assigns, picks and dispatches it', async () => {
    // 0. La cosecha es válida y lleva geo solo cuando hay lat+lon.
    expect(
      validateHarvestForm({
        farmId: 'finca-el-mirador',
        quality: 'MADURO',
        harvester: 'Juan Perez',
        harvestedAt: '2026-11-01T06:00',
        cherryKg: '1.2',
      }),
    ).toBeNull();
    expect(buildHarvestGeo('4.71', '-75.68')).toEqual({ lat: 4.71, lon: -75.68 });
    expect(buildHarvestGeo('', '')).toBeUndefined();

    // 1-12. Respuestas en el orden exacto en que el flujo las pide.
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, harvestId: 'h-1', harvestReferenceId: 'harv-001' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [{ farmId: 'finca-el-mirador' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              harvestId: 'h-1',
              harvestReferenceId: 'harv-001',
              farmId: 'finca-el-mirador',
              cherryKg: 1.2,
              quality: 'MADURO',
              harvester: 'Juan Perez',
              harvestedAt: '2026-11-01T06:00:00.000Z',
              createdAt: '2026-11-01T07:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          harvestId: 'h-1',
          harvestReferenceId: 'harv-001',
          farmId: 'finca-el-mirador',
          cherryKg: 1.2,
          quality: 'MADURO',
          harvester: 'Juan Perez',
          harvestedAt: '2026-11-01T06:00:00.000Z',
          createdAt: '2026-11-01T07:00:00.000Z',
        }),
      })
      // 5. Puente finca→planta: el lote empacado nace del proceso. El contrato
      // 1.2.0 no devuelve lotCode en el alta de cosecha, así que el flujo lo
      // registra con createLot (gap documentado en el diseño).
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          lotCode: 'LOT-A',
          sku: 'SKU-1',
          roastedAt: '2026-10-01T00:00:00.000Z',
          bestBefore: '2026-12-01T00:00:00.000Z',
          status: 'AVAILABLE',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, countReferenceId: 'cnt-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              locationId: 'l-cd',
              sku: 'SKU-1',
              lotCode: 'LOT-A',
              lotStatus: 'AVAILABLE',
              onHand: 10,
              reserved: 0,
              allocated: 0,
              available: 10,
              bestBefore: '2026-12-01T00:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          options: [
            {
              locationId: 'l-cd',
              name: 'CD Norte',
              fullyAvailable: true,
              lines: [{ sku: 'SKU-1', requested: 2, available: 10 }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, fulfillmentLocationId: 'l-cd' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, picked: [{ lotCode: 'LOT-A', quantity: 2 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    // 1. Crear cosecha.
    const created = await backofficeApi.createHarvest({
      harvestReferenceId: 'harv-001',
      farmId: 'finca-el-mirador',
      farmGeo: { lat: 4.71, lon: -75.68 },
      cherryKg: 1.2,
      quality: 'MADURO',
      harvester: 'Juan Perez',
      harvestedAt: '2026-11-01T06:00:00.000Z',
    });
    expect(created.harvestId).toBe('h-1');
    expect(fetchMock.mock.calls[0][0]).toContain('/backoffice/wms/harvests');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });

    // 2-4. Fincas, lista por finca (farmId obligatorio viaja en el query) y detalle.
    await backofficeApi.listHarvestFarms();
    const harvests = await backofficeApi.listHarvests({ farmId: 'finca-el-mirador' });
    expect(harvests).toHaveLength(1);
    expect(fetchMock.mock.calls[2][0]).toContain('farmId=finca-el-mirador');
    await backofficeApi.getHarvest('h-1');

    // 5. Alta del lote empacado que representa esa cosecha ya procesada.
    const lot = await backofficeApi.createLot({
      lotReferenceId: 'lotref-1',
      lotCode: 'LOT-A',
      sku: 'SKU-1',
      roastedAt: '2026-10-01T00:00:00.000Z',
      bestBefore: '2026-12-01T00:00:00.000Z',
      locationId: 'l-cd',
      initialQuantityGrams: 5000,
      actorId: 'a-1',
      at: AT,
    });
    expect(lot.lotCode).toBe('LOT-A');

    // 6. Conteo inicial en el CD (10 bolsas de 250 g).
    const count = buildCountRequest({
      referenceId: 'cnt-1',
      locationId: 'l-cd',
      reason: 'conteo inicial',
      lines: [{ lotCode: 'LOT-A', bags: 10, gramsPerBag: 250 }],
      actorId: 'a-1',
      at: AT,
    });
    expect(count).toEqual({
      ok: true,
      request: {
        countReferenceId: 'cnt-1',
        locationId: 'l-cd',
        reason: 'conteo inicial',
        lines: [{ lotCode: 'LOT-A', countedKg: 2.5 }],
        actorId: 'a-1',
        at: AT,
      },
    });
    if (count.ok !== true) throw new Error('count should be ok');
    const counted = await backofficeApi.createCount(count.request);
    expect(counted.success).toBe(true);

    // 7-8. Stock disponible y opciones de fulfillment con cobertura total.
    const stock = await backofficeApi.getStock();
    expect(stock[0].available).toBe(10);
    const options = await backofficeApi.getFulfillmentOptions('o-1');
    expect(coverage(options[0])).toBe('ALL');
    expect(shortfall(options[0])).toEqual([]);
    expect(validateAssign({ alreadyAssigned: false, reason: '' })).toBeNull();

    // 9. Asignar al CD.
    const assigned = await backofficeApi.assignOrder('o-1', {
      fulfillmentLocationId: 'l-cd',
      actorId: 'a-1',
      at: AT,
    });
    expect(assigned.fulfillmentLocationId).toBe('l-cd');

    // 10. Preparar por escaneo: 2 unidades del lote.
    let lines = pickLines([{ sku: 'SKU-1', quantity: 2 }]);
    expect(canStartPicking([])).toBe(true);
    const first = addLineScan(lines, { lotCode: 'LOT-A', sku: 'SKU-1' });
    if (first.ok !== true) throw new Error('first scan should fit');
    lines = first.lines;
    const second = addLineScan(lines, { lotCode: 'LOT-A', sku: 'SKU-1' });
    if (second.ok !== true) throw new Error('second scan should fit');
    lines = second.lines;
    expect(isComplete(lines)).toBe(true);
    const picked = await backofficeApi.pickOrder('o-1', {
      pickReferenceId: 'p-1',
      scans: [{ lotCode: 'LOT-A', quantity: 2 }],
      actorId: 'a-1',
      at: AT,
    });
    expect(picked.success).toBe(true);

    // 11. Despacho desde el CD (sin tienda de retiro → SHIP con courier).
    expect(dispatchMode({})).toBe('SHIP');
    const dispatched = await backofficeApi.transitionOrder('o-1', 'DISPATCHED', {
      trackingNumber: 'TRK-1',
      courierName: 'Courier',
    });
    expect(dispatched).toEqual({ success: true });
    const [dispatchUrl, dispatchInit] = fetchMock.mock.calls[10];
    expect(dispatchUrl).toContain('/backoffice/orders/o-1/transition');
    expect(JSON.parse(dispatchInit.body)).toMatchObject({ newStatus: 'DISPATCHED' });

    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it('resolves a shortfall with a transfer, warns FEFO and sends to the pickup store', async () => {
    // Cobertura parcial: faltan 2 de SKU-1 en el CD elegido.
    const option = {
      locationId: 'l-cd',
      name: 'CD Norte',
      fullyAvailable: false,
      lines: [{ sku: 'SKU-1', requested: 5, available: 3 }],
    };
    expect(coverage(option)).toBe('PARTIAL');
    const missing = shortfall(option);
    expect(missing).toEqual([{ sku: 'SKU-1', missing: 2 }]);
    expect(
      sourceCandidates(
        [
          { locationId: 'l-sur', sku: 'SKU-1', available: 5 },
          { locationId: 'l-chica', sku: 'SKU-1', available: 1 },
        ],
        missing,
        'l-cd',
      ),
    ).toEqual(['l-sur']);

    // Traslado del faltante vinculado al pedido.
    expect(
      validateNewTransfer({ fromLocationId: 'l-sur', toLocationId: 'l-cd', lines: [{ lotCode: 'LOT-A', quantity: 2 }] }),
    ).toBeNull();
    expect(
      validateNewTransfer({ fromLocationId: 'l-cd', toLocationId: 'l-cd', lines: [{ lotCode: 'LOT-A', quantity: 1 }] }),
    ).toBe('El origen y el destino no pueden ser iguales');

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          transferId: 't-1',
          status: 'IN_TRANSIT',
          fromLocationId: 'l-sur',
          toLocationId: 'l-cd',
          forOrderId: 'o-2',
          lines: [{ sku: 'SKU-1', quantity: 2, lots: [{ lotCode: 'LOT-A', shipped: 2 }] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          transferId: 't-1',
          status: 'IN_TRANSIT',
          fromLocationId: 'l-sur',
          toLocationId: 'l-cd',
          forOrderId: 'o-2',
          lines: [{ sku: 'SKU-1', quantity: 2, lots: [{ lotCode: 'LOT-A', shipped: 2 }] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          transferId: 't-1',
          status: 'RECEIVED',
          fromLocationId: 'l-sur',
          toLocationId: 'l-cd',
          forOrderId: 'o-2',
          lines: [{ sku: 'SKU-1', quantity: 2, lots: [{ lotCode: 'LOT-A', shipped: 2, received: 1 }] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, transferId: 't-9' }),
      });

    const transfer = await backofficeApi.createInventoryTransfer({
      transferReferenceId: 'tr-1',
      fromLocationId: 'l-sur',
      toLocationId: 'l-cd',
      forOrderId: 'o-2',
      lines: [{ sku: 'SKU-1', quantity: 2, lots: [{ lotCode: 'LOT-A', shipped: 2 }] }],
      actorId: 'a-1',
      at: AT,
    });
    expect(transfer.forOrderId).toBe('o-2');

    // Mientras el traslado sigue abierto no se puede preparar.
    expect(canStartPicking([{ status: transfer.status }])).toBe(false);
    await backofficeApi.shipInventoryTransfer('t-1', {
      shipReferenceId: 'sh-1',
      scans: ['LOT-A'],
      actorId: 'a-1',
      at: AT,
    });
    expect(canStartPicking([{ status: 'RECEIVED' }])).toBe(true);

    // Recepción con merma: llegó 1 de 2.
    const proposed = buildReceiveLines(transfer);
    expect(proposed).toEqual([{ lotCode: 'LOT-A', receivedQuantity: 2 }]);
    const receivedLines = [{ lotCode: 'LOT-A', receivedQuantity: 1 }];
    expect(receiveShortfall(receivedLines, [{ lotCode: 'LOT-A', shipped: 2 }])).toEqual([
      { lotCode: 'LOT-A', missing: 1 },
    ]);
    const received = await backofficeApi.receiveInventoryTransfer('t-1', {
      receiveReferenceId: 'rc-1',
      lines: receivedLines,
      actorId: 'a-1',
      at: AT,
    });
    expect(received.status).toBe('RECEIVED');

    // FEFO: escanear LOT-B cuando LOT-A vence antes exige motivo.
    const stockRows = [
      { lotCode: 'LOT-A', bestBefore: '2026-11-01T00:00:00.000Z', lotStatus: 'AVAILABLE' },
      { lotCode: 'LOT-B', bestBefore: '2026-12-01T00:00:00.000Z', lotStatus: 'AVAILABLE' },
    ];
    expect(fefoWarning('LOT-B', stockRows)).toBe('LOT-A');
    expect(needsFefoReason('LOT-B', stockRows)).toBe(true);
    expect(needsFefoReason('LOT-A', stockRows)).toBe(false);

    // Retiro en otra tienda: se envía y queda listo para retiro allá.
    expect(dispatchMode({ pickupLocationId: 'l-tienda', fulfillmentLocationId: 'l-cd' })).toBe(
      'SEND_TO_STORE',
    );
    expect(dispatchMode({ pickupLocationId: 'l-cd', fulfillmentLocationId: 'l-cd' })).toBe(
      'READY_HERE',
    );
    const sent = await backofficeApi.sendOrderToPickupStore('o-2', {
      sendReferenceId: 's-1',
      actorId: 'a-1',
      at: AT,
    });
    expect(sent.transferId).toBe('t-9');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
