import { test, expect } from '@playwright/test';

/**
 * FUNCTIONAL TESTS — Backoffice Trazabilidad.
 * Validates the lot search UI renders correctly and search interaction works.
 */
const API_HOST = process.env.API_URL ?? 'https://api.armachecafe.com';

test.describe('backoffice functional: trazabilidad', () => {
  test('página de trazabilidad carga con formulario de búsqueda', async ({ page }) => {
    await page.goto('/trazabilidad/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('trazabilidad-admin-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('traceability-search-input')).toBeVisible();
    await expect(page.getByTestId('traceability-search-button')).toBeVisible();

    // No rendering errors
    const bodyText = await page.locator('main').textContent();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
  });

  test('búsqueda de lote — submit vacío no crashea (validación client-side)', async ({ page }) => {
    const httpErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().startsWith(API_HOST) && resp.status() >= 500) {
        httpErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.goto('/trazabilidad/');
    await page.waitForLoadState('networkidle');

    // Submit empty search — should not cause 500 or crash
    await page.getByTestId('traceability-search-button').click();
    await page.waitForTimeout(1000);

    // Page should still be functional (search input still visible)
    await expect(page.getByTestId('traceability-search-input')).toBeVisible();

    // No 5xx from API
    const server5xx = httpErrors.filter((e) => e.startsWith('5'));
    expect(server5xx).toHaveLength(0);
  });
});
