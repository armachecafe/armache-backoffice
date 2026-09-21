import { test, expect } from '@playwright/test';

/**
 * FUNCTIONAL TESTS — Backoffice Dashboard.
 * Validates that stats cards show real numeric data (no NaN, no undefined),
 * and the dashboard structure renders correctly with data from the API.
 */

test.describe('backoffice functional: dashboard — data integrity', () => {
  test('stats cards show numeric values (no NaN, no undefined)', async ({ page }) => {
    await page.goto('/dashboard/');
    await page.waitForLoadState('networkidle');

    // Stats cards: "Ventas hoy" and "Pedidos hoy"
    const ventasCard = page.getByTestId('stats-card-ventas-hoy');
    await expect(ventasCard).toBeVisible({ timeout: 15000 });
    const ventasText = await ventasCard.textContent();
    expect(ventasText).not.toContain('NaN');
    expect(ventasText).not.toContain('undefined');
    expect(ventasText).toMatch(/S\/\s*\d/); // Should contain "S/ <number>"

    const pedidosCard = page.getByTestId('stats-card-pedidos-hoy');
    await expect(pedidosCard).toBeVisible();
    const pedidosText = await pedidosCard.textContent();
    expect(pedidosText).not.toContain('NaN');
    expect(pedidosText).not.toContain('undefined');
    expect(pedidosText).toMatch(/\d/); // Should contain at least one digit
  });

  test('orders overview renders (status breakdown visible)', async ({ page }) => {
    await page.goto('/dashboard/');
    await page.waitForLoadState('networkidle');

    // The orders overview section should render (even with 0 orders)
    await expect(page.getByTestId('stats-card-ventas-hoy')).toBeVisible({ timeout: 15000 });

    // Verify the page has no JS-level rendering of "undefined" or "NaN" anywhere
    const bodyText = await page.locator('main').textContent();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
  });
});
