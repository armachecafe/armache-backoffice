import { test, expect } from '@playwright/test';
import { attachConsoleGuard, describeProblems } from '../../helpers/console-guard';

/**
 * LIVE E2E — cosecha → distribución.
 *
 * - Por defecto es READ-ONLY (camina finca/inventario/despacho sin crear nada).
 * - La creación de cosecha solo corre con LIVE_WRITE_ENABLED=1.
 * - La mutación de un pedido de prueba solo corre con LIVE_TEST_ORDER_ID (+ opcional
 *   LIVE_DISTRIBUTION_LOCATION_ID). Sin esas env, se skipea.
 *
 * Nunca corre en CI por defecto: el config de prod-smoke apunta a
 * https://admin.armachecafe.com con datos reales.
 *
 * Usuarios efímeros (repo armachecafe, scripts/create-ephemeral-users.sh):
 *   cd /home/carmanuel/Workspace/armachecafe
 *   source scripts/pulumi-env.sh
 *   bash scripts/create-ephemeral-users.sh [RUN_ID]  # imprime JSON con runId +
 *     customerEmail/Password y backofficeEmail/Password (+ subs y pool/client IDs)
 *   Mapeo: backofficeEmail → BACKOFFICE_EMAIL y STAFF_EMAIL (ambas, mismo valor);
 *   backofficePassword → BACKOFFICE_PASSWORD y STAFF_PASSWORD. Este setup acepta
 *   ambas variantes (BACKOFFICE_* gana); exportar las dos evita el guest-storageState.
 *
 * Límite del teardown (verificado contra payment/teardown.service.ts): la Lambda
 * armache-test-teardown borra order/payment/cart/notification, rol IAM ADMIN,
 * catálogo con ownerId+testRunId, S3 catalog/test/<runId>/ y los 2 usuarios Cognito.
 * NO borra WMS (harvests, lots, transfers, counts) ni MES/trazabilidad: cada cosecha
 * E2E-LIVE-* creada acá queda en prod hasta purga manual. Además el orquestador
 * run-prod-verification.sh invoca con key "backofficeUserId" pero el handler exige
 * "staffUserId" (teardown.service.ts:310), así que el cleanup automático hoy es
 * rechazado en fail-closed — corregir en backend antes de confiar en él.
 *
 * Env:
 *   BACKOFFICE_URL | STAFF alt.    (default https://admin.armachecafe.com)
 *   BACKOFFICE_EMAIL | STAFF_EMAIL
 *   BACKOFFICE_PASSWORD | STAFF_PASSWORD
 *   LIVE_WRITE_ENABLED=1           habilita la creación de 1 cosecha de prueba
 *   LIVE_TEST_ORDER_ID=...         pedido CONFIRMED de prueba para asignar/preparar
 *   LIVE_DISTRIBUTION_LOCATION_ID  CD destino (si se omite, se usa la primera opción)
 *
 * La cosecha de prueba se marca con harvester `E2E-LIVE-<timestamp>` para
 * identificarla y purgarla después. Cada corrida crea 1 registro.
 */

const LIVE_WRITE = process.env.LIVE_WRITE_ENABLED === '1';
const TEST_ORDER_ID = process.env.LIVE_TEST_ORDER_ID;
const TEST_LOCATION_ID = process.env.LIVE_DISTRIBUTION_LOCATION_ID;

test.describe('live e2e: cosecha → distribución (read-only walk)', () => {
  test('finca + inventario + despacho cargan sin 5xx ni errores JS', async ({ page }) => {
    const problems = attachConsoleGuard(page, test.info());

    const routes = [
      { path: '/finca/cosechas/', testid: 'cosechas-page' },
      { path: '/inventario/ubicaciones/', testid: 'ubicaciones-page' },
      { path: '/inventario/stock/', testid: 'stock-page' },
      { path: '/inventario/traslados/', testid: 'traslados-page' },
      { path: '/inventario/conteos/', testid: 'conteos-page' },
      { path: '/despacho/asignacion/', testid: 'asignacion-page' },
      { path: '/despacho/preparacion/', testid: 'preparacion-page' },
      { path: '/despacho/retiro/', testid: 'retiro-page' },
    ] as const;

    for (const { path, testid } of routes) {
      const resp = await page.goto(path);
      expect(resp?.status(), `${path} HTTP status`).toBeLessThan(500);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByTestId(testid), `${path} renders`).toBeVisible({ timeout: 15000 });
    }

    const bodyText = await page.locator('main').textContent();
    expect(bodyText).not.toContain('NaN');

    expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });

  test('combo de fincas: con opciones permite elegir, vacío muestra el aviso', async ({ page }) => {
    const problems = attachConsoleGuard(page, test.info());

    // Formulario: el aviso de estado vacío y las opciones son excluyentes.
    await page.goto('/finca/cosechas/nueva/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('harvest-form')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(async () => page.getByTestId('harvest-farm-select').locator('option').count(), {
        timeout: 15000,
      })
      .toBeGreaterThanOrEqual(1);
    const optionCount = await page.getByTestId('harvest-farm-select').locator('option').count();
    if (optionCount > 1) {
      await expect(page.getByTestId('harvest-no-farms')).toHaveCount(0);
      await expect(page.getByTestId('harvest-farms-error')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('harvest-no-farms')).toBeVisible({ timeout: 5000 });
      expect(await page.getByTestId('harvest-no-farms').textContent()).toContain(
        'No hay fincas registradas',
      );
    }

    // Lista: mismo contrato en el filtro.
    await page.goto('/finca/cosechas/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('cosechas-page')).toBeVisible({ timeout: 15000 });
    const filterCount = await page
      .getByTestId('cosechas-farm-filter')
      .locator('option')
      .count();
    if (filterCount > 1) {
      await expect(page.getByTestId('cosechas-no-farms-options')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('cosechas-no-farms-options')).toBeVisible({ timeout: 5000 });
    }

    expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });
});

test.describe('live e2e: crear cosecha (escritura con guard)', () => {
  test.skip(!LIVE_WRITE, 'Requiere LIVE_WRITE_ENABLED=1 para crear 1 cosecha de prueba en live.');

  test('registra una cosecha y la ve en lista + detalle', async ({ page }) => {
    const problems = attachConsoleGuard(page, test.info());
    const tag = `E2E-LIVE-${Date.now()}`;

    // 1. Abrir formulario.
    await page.goto('/finca/cosechas/nueva/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('nueva-cosecha-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('harvest-form')).toBeVisible();

    // 2. La finca es obligatoria: el backend 400ea sin farmId, así que el select
    // debe poblarse desde /harvests/farms antes de enviar. Polling del lado Node
    // (el CSP de prod bloquea waitForFunction con string: script-src sin unsafe-eval).
    await expect(page.getByTestId('harvest-farm-select')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('harvest-farm-select').locator('option').count(), {
        timeout: 15000,
      })
      .toBeGreaterThan(1);
    const farmValue = await page.getByTestId('harvest-farm-select').inputValue();
    if (!farmValue) {
      await page.getByTestId('harvest-farm-select').selectOption({ index: 1 });
    }

    // 3. Completar formulario con datos de prueba identificables.
    await page.getByTestId('harvest-kg').fill('1200');
    await page.getByTestId('harvest-quality').selectOption('MADURO');
    await page.getByTestId('harvest-harvester').fill(tag);
    const harvestedAt = new Date().toISOString().slice(0, 16); // datetime-local
    await page.getByTestId('harvest-harvested-at').fill(harvestedAt);

    // 4. Enviar y esperar redirect a /finca/cosechas.
    await page.getByTestId('harvest-submit').click();
    await expect(page).toHaveURL(/\/finca\/cosechas\/?$/, { timeout: 20000 });
    await expect(page.getByTestId('cosechas-page')).toBeVisible({ timeout: 15000 });

    // 5. La cosecha nueva aparece en la lista (filtrada por la finca elegida).
    // El formulario redirige sin preservar la finca, así que se re-selecciona.
    const selectedFarm = await page.getByTestId('cosechas-farm-filter').inputValue().catch(() => '');
    if (!selectedFarm) {
      await page.getByTestId('cosechas-farm-filter').selectOption({ index: 1 });
    }
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('main').textContent();
    expect(bodyText).toContain(tag);

    // 6. Abrir el detalle de esa fila.
    const row = page.locator('[data-testid^="cosecha-row-"]', { hasText: tag }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click();
    await expect(page.getByTestId('cosecha-detail')).toBeVisible({ timeout: 15000 });
    expect(await page.getByTestId('cosecha-detail').textContent()).toContain(tag);

    expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });

  test('crea una finca FARM y le registra una cosecha', async ({ page }) => {
    const problems = attachConsoleGuard(page, test.info());
    const stamp = Date.now().toString().slice(-6);
    const farmCode = `E2E-FINCA-${stamp}`;
    const tag = `E2E-LIVE-${Date.now()}`;

    // 1. Crear la finca (Location con rol FARM).
    await page.goto('/inventario/ubicaciones/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('ubicaciones-page')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('ubicaciones-new').click();
    await expect(page.getByTestId('ubicacion-form')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('ubicacion-code').fill(farmCode);
    await page.getByTestId('ubicacion-name').fill(`Finca E2E ${stamp}`);
    await page.getByTestId('ubicacion-role-FARM').check();
    await page.getByTestId('ubicacion-submit').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="ubicaciones-table"]')).toContainText(farmCode, {
      timeout: 15000,
    });

    // 2. La finca nueva llega al combo de cosechas (master Location FARM).
    await page.goto('/finca/cosechas/nueva/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('harvest-form')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(async () => page.getByTestId('harvest-farm-select').locator('option').count(), {
        timeout: 15000,
      })
      .toBeGreaterThan(1);
    await page.getByTestId('harvest-farm-select').selectOption(farmCode);
    await expect(page.getByTestId('harvest-no-farms')).toHaveCount(0);

    // 3. Registrar la cosecha contra esa finca.
    await page.getByTestId('harvest-kg').fill('1500');
    await page.getByTestId('harvest-quality').selectOption('MIXTO');
    await page.getByTestId('harvest-harvester').fill(tag);
    await page.getByTestId('harvest-harvested-at').fill(new Date().toISOString().slice(0, 16));
    await page.getByTestId('harvest-submit').click();
    await expect(page).toHaveURL(/\/finca\/cosechas\/?$/, { timeout: 20000 });

    // 4. Filtrar por la finca y abrir el detalle.
    await expect(page.getByTestId('cosechas-page')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('cosechas-farm-filter').selectOption(farmCode);
    await page.waitForLoadState('networkidle');
    const newRow = page.locator('[data-testid^="cosecha-row-"]', { hasText: tag }).first();
    await expect(newRow).toBeVisible({ timeout: 15000 });
    await newRow.click();
    await expect(page.getByTestId('cosecha-detail')).toBeVisible({ timeout: 15000 });
    const detail = await page.getByTestId('cosecha-detail').textContent();
    expect(detail).toContain(tag);
    expect(detail).toContain(farmCode);

    expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });
});

test.describe('live e2e: asignar + empezar preparación (pedido de prueba)', () => {
  test.skip(
    !LIVE_WRITE || !TEST_ORDER_ID,
    'Requiere LIVE_WRITE_ENABLED=1 y LIVE_TEST_ORDER_ID (pedido CONFIRMED de prueba).',
  );

  test('asigna el pedido al CD y lo pasa a PREPARING', async ({ page }) => {
    const problems = attachConsoleGuard(page, test.info());
    const orderId = TEST_ORDER_ID as string;

    // 1. Cola Por asignar: el pedido de prueba debe estar visible.
    await page.goto('/despacho/asignacion/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('asignacion-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('asignacion-tab-unassigned')).toBeVisible();

    const orderRow = page.getByTestId(`asignacion-order-${orderId}`);
    await expect(orderRow).toBeVisible({ timeout: 15000 });
    await orderRow.click();
    await expect(page.getByTestId('asignacion-panel')).toBeVisible({ timeout: 15000 });

    // 2. Elegir CD: el indicado por env o la primera opción disponible.
    if (TEST_LOCATION_ID) {
      await page.getByTestId(`asignacion-option-${TEST_LOCATION_ID}`).click();
    } else {
      const firstOption = page.locator('[data-testid^="asignacion-option-"]').first();
      await expect(firstOption).toBeVisible({ timeout: 15000 });
      await firstOption.click();
    }
    await page.getByTestId('asignacion-submit').click();

    // 3. Tras asignar, el pedido sale de la cola Por asignar.
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId(`asignacion-order-${orderId}`)).toHaveCount(0, { timeout: 15000 });

    // 4. En Preparación, con ese CD elegido, el pedido aparece Por empezar.
    // El LocationPicker guarda en localStorage; se elige el CD por UI.
    await page.goto('/despacho/preparacion/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('preparacion-page')).toBeVisible({ timeout: 15000 });
    // El CD se selecciona a mano en el picker si la cola llega vacía; el spec
    // no adivina el locationId cuando no vino por env.
    if (TEST_LOCATION_ID) {
      await page.getByTestId('location-picker-select').selectOption(TEST_LOCATION_ID);
      await page.waitForLoadState('networkidle');
    }
    const startBtn = page.getByTestId(`preparacion-start-${orderId}`);
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await startBtn.click();
    await page.waitForLoadState('networkidle');

    // 5. Pasa a En preparación (veredicto UI, sin escanear lotes reales).
    await expect(page.getByTestId(`preparacion-order-${orderId}`)).toBeVisible({ timeout: 15000 });

    expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });
});
