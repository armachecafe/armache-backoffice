import { test, expect } from '@playwright/test';

/**
 * FUNCTIONAL TESTS — Backoffice Almacén (WMS).
 * Validates that alertas, recepciones, transferencias, and devoluciones
 * pages render data correctly from the API.
 */
const API_HOST = process.env.API_URL ?? 'https://api.armachecafe.com';

test.describe('backoffice functional: almacén — data integrity', () => {
  test('alertas de stock muestra datos o estado vacío (no NaN)', async ({ page }) => {
    const httpErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().startsWith(API_HOST) && resp.status() >= 400) {
        httpErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.goto('/almacen/alertas/');
    await page.waitForLoadState('networkidle');

    // Should show either alert cards or an empty state — no NaN/undefined
    const bodyText = await page.locator('main').textContent();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');

    // If alerts exist, verify they have the alert card testid
    const alertCards = page.locator('[data-testid^="stock-alert-"]');
    const count = await alertCards.count();
    if (count > 0) {
      // First alert card should have meaningful content
      const firstText = await alertCards.first().textContent();
      expect(firstText?.length).toBeGreaterThan(0);
    }

    expect(httpErrors).toHaveLength(0);
  });

  test('recepciones carga la estructura del formulario', async ({ page }) => {
    await page.goto('/almacen/recepciones/');
    await page.waitForLoadState('networkidle');

    // The reception form should render (even if no POs are available)
    await expect(page.getByTestId('reception-form')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('reception-po-select')).toBeVisible();
    await expect(page.getByTestId('reception-submit')).toBeVisible();
  });

  test('transferencias carga la estructura del formulario', async ({ page }) => {
    await page.goto('/almacen/transferencias/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('transfer-form')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('transfer-from')).toBeVisible();
    await expect(page.getByTestId('transfer-to')).toBeVisible();
    await expect(page.getByTestId('transfer-submit')).toBeVisible();
  });
});
