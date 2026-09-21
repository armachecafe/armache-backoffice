import { test, expect } from '@playwright/test';

/**
 * FUNCTIONAL TESTS — Backoffice Reportes.
 * Validates that report pages render data (tables, numbers) from the API
 * without NaN/undefined errors.
 */
const API_HOST = process.env.API_URL ?? 'https://api.armachecafe.com';

test.describe('backoffice functional: reportes — data integrity', () => {
  test('página de reportes carga sin errores de datos', async ({ page }) => {
    const httpErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().startsWith(API_HOST) && resp.status() >= 400) {
        httpErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.goto('/reportes/');
    await page.waitForLoadState('networkidle');

    // Heading visible
    await expect(page.getByRole('heading', { name: /reporte/i })).toBeVisible({ timeout: 15000 });

    // No NaN/undefined in the page content
    const bodyText = await page.locator('main').textContent();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');

    // No API errors
    expect(httpErrors).toHaveLength(0);
  });
});
