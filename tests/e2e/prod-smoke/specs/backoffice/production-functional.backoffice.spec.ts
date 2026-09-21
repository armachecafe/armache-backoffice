import { test, expect } from '@playwright/test';

/**
 * FUNCTIONAL TESTS — Backoffice Producción (MES).
 * Validates production orders list, history, and the new order form.
 */
const API_HOST = process.env.API_URL ?? 'https://api.armachecafe.com';

test.describe('backoffice functional: producción — data integrity', () => {
  test('lista de órdenes MES carga sin errores de datos', async ({ page }) => {
    const httpErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().startsWith(API_HOST) && resp.status() >= 400) {
        httpErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.goto('/produccion/');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('main').textContent();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
    expect(httpErrors).toHaveLength(0);
  });

  test('historial MES muestra tabla con datos o vacío limpio', async ({ page }) => {
    await page.goto('/produccion/historial/');
    await page.waitForLoadState('networkidle');

    // Wait for the page container (always present after loading)
    await expect(page.getByTestId('historial-page')).toBeVisible({ timeout: 15000 });

    // Either the table renders (orders exist) or the empty state shows — both are valid
    const table = page.getByTestId('production-history-table');
    const hasTable = await table.isVisible().catch(() => false);

    if (!hasTable) {
      // Empty state: "Sin órdenes de producción" text should be present
      const bodyText = await page.locator('main').textContent();
      expect(bodyText).toContain('Sin órdenes de producción');
    }

    // Either way, no NaN/undefined
    const bodyText = await page.locator('main').textContent();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
  });

  test('formulario nueva orden de producción tiene campos requeridos', async ({ page }) => {
    await page.goto('/produccion/nueva/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('new-order-form')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('new-order-input-sku')).toBeVisible();
    await expect(page.getByTestId('new-order-lot-code')).toBeVisible();
    await expect(page.getByTestId('new-order-qty')).toBeVisible();
    await expect(page.getByTestId('new-order-submit')).toBeVisible();

    // Process selector should have at least one option
    const processButtons = page.locator('[data-testid^="process-"]');
    expect(await processButtons.count()).toBeGreaterThan(0);
  });
});
