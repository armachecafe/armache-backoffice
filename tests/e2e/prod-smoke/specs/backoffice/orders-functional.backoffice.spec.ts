import { test, expect } from '@playwright/test';

/**
 * FUNCTIONAL TESTS — Backoffice Pedidos.
 * Validates order list data, detail view, and B2B form structure.
 */
const API_HOST = process.env.API_URL ?? 'https://api.armachecafe.com';

test.describe('backoffice functional: pedidos — data integrity', () => {
  test('lista de pedidos muestra datos reales (código, monto, estado)', async ({ page }) => {
    await page.goto('/pedidos/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('pedidos-page')).toBeVisible({ timeout: 15000 });

    // Check if there are order rows
    const orderRows = page.locator('[data-testid^="order-row-"]');
    const count = await orderRows.count();

    if (count === 0) {
      // Empty state is acceptable — verify it renders cleanly
      const bodyText = await page.locator('main').textContent();
      expect(bodyText).not.toContain('NaN');
      expect(bodyText).not.toContain('undefined');
      console.warn('Sin pedidos — se verifica que la página no tiene errores de renderizado');
      return;
    }

    // Verify first order row has meaningful data
    const firstRow = orderRows.first();
    const rowText = await firstRow.textContent();
    expect(rowText).not.toContain('NaN');
    expect(rowText).not.toContain('undefined');
    // Order code pattern: AC-XXXXXX or similar
    expect(rowText).toMatch(/AC-\d{4,}|[A-Z]{2,}-\d+/);
  });

  test('detalle de pedido carga con datos del API', async ({ page }) => {
    const httpErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().startsWith(API_HOST) && resp.status() >= 400) {
        httpErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.goto('/pedidos/');
    await page.waitForLoadState('networkidle');

    const orderLink = page.locator('[data-testid^="order-row-"]').first();
    if (await orderLink.count() === 0) {
      console.warn('Sin pedidos — se omite test de detalle');
      return;
    }

    await orderLink.click();
    await page.waitForLoadState('networkidle');

    // Should navigate to /pedidos/detalle/?id=...
    await expect(page).toHaveURL(/\/pedidos\/detalle\/\?id=.+/, { timeout: 10000 });

    // Back link must be visible (proves the detail page rendered, not the list)
    await expect(page.getByTestId('order-detail-back')).toBeVisible({ timeout: 15000 });

    // Verify no NaN/undefined in the detail view
    const bodyText = await page.locator('main').textContent();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');

    // No API errors
    expect(httpErrors).toHaveLength(0);
  });
});

test.describe('backoffice functional: pedidos B2B — formulario', () => {
  test('formulario B2B carga y tiene campos requeridos', async ({ page }) => {
    await page.goto('/pedidos/b2b/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('pedido-b2b-page')).toBeVisible({ timeout: 15000 });

    // Required fields are present
    await expect(page.getByTestId('b2b-client-name')).toBeVisible();
    await expect(page.getByTestId('b2b-client-company')).toBeVisible();
    await expect(page.getByTestId('b2b-contact-email')).toBeVisible();
    await expect(page.getByTestId('b2b-contact-phone')).toBeVisible();
    await expect(page.getByTestId('b2b-item-sku-0')).toBeVisible();
    await expect(page.getByTestId('b2b-item-qty-0')).toBeVisible();
    await expect(page.getByTestId('b2b-item-price-0')).toBeVisible();
    await expect(page.getByTestId('b2b-submit')).toBeVisible();
  });
});
