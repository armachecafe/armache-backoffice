import { test, expect } from '@playwright/test';

/**
 * FUNCTIONAL TESTS — Backoffice Catálogo.
 * Validates that product data from the API renders correctly (no NaN, no 0.00 when
 * products have real prices) and that edit/actions work end-to-end.
 */
const API_HOST = process.env.API_URL ?? 'https://api.armachecafe.com';

test.describe('backoffice functional: catálogo — data integrity', () => {
  test('listado de productos muestra precio real (no NaN, no S/ 0.00 para todos)', async ({ page }) => {
    await page.goto('/catalogo/');
    await page.waitForLoadState('networkidle');

    // Wait for products to load (skeleton disappears)
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Get all price cells (column 3 = Precio)
    const priceCells = page.locator('tbody tr td:nth-child(3)');
    const count = await priceCells.count();

    if (count === 0) {
      console.warn('Sin productos en catálogo — se omite validación de precios');
      return;
    }

    // At least one product should have a price > 0.00 (proves enrichment works)
    let hasNonZeroPrice = false;
    let hasNaN = false;

    for (let i = 0; i < count; i++) {
      const text = await priceCells.nth(i).textContent();
      if (text?.includes('NaN')) hasNaN = true;
      if (text && !text.includes('NaN') && !text.includes('0.00')) hasNonZeroPrice = true;
    }

    expect(hasNaN, 'Ningún precio debería mostrar NaN').toBe(false);
    expect(hasNonZeroPrice, 'Al menos un producto debe tener precio real (no S/ 0.00)').toBe(true);
  });

  test('listado de productos muestra SKU (no vacío para todos)', async ({ page }) => {
    await page.goto('/catalogo/');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // SKU column (column 2, hidden on mobile — verify on desktop viewport)
    const skuCells = page.locator('tbody tr td:nth-child(2)');
    const count = await skuCells.count();
    if (count === 0) return;

    let hasNonEmptySku = false;
    for (let i = 0; i < count; i++) {
      const text = (await skuCells.nth(i).textContent())?.trim();
      if (text && text.length > 0) hasNonEmptySku = true;
    }

    expect(hasNonEmptySku, 'Al menos un producto debe mostrar SKU').toBe(true);
  });

  test('editar producto — precio cargado no es NaN ni vacío', async ({ page }) => {
    const httpErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().startsWith(API_HOST) && resp.status() >= 400) {
        httpErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.goto('/catalogo/');
    await page.waitForLoadState('networkidle');

    const editLink = page.locator('[data-testid^="catalogo-edit-"]').first();
    if (await editLink.count() === 0) {
      console.warn('Sin productos — se omite test de edición de precio');
      return;
    }

    await editLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('editar-producto-page')).toBeVisible({ timeout: 15000 });

    // Price input must have a valid numeric value (not NaN, not empty, not "0")
    const priceInput = page.getByTestId('edit-product-price');
    const priceValue = await priceInput.inputValue();
    expect(priceValue).not.toBe('');
    expect(priceValue).not.toBe('NaN');
    expect(Number(priceValue)).toBeGreaterThan(0);

    // Name must be populated
    const nameValue = await page.getByTestId('edit-product-name').inputValue();
    expect(nameValue.length).toBeGreaterThan(0);

    // No API errors
    expect(httpErrors).toHaveLength(0);
  });
});

test.describe('backoffice functional: catálogo — acciones', () => {
  test('editar producto — guardar cambios (no-op update) retorna éxito', async ({ page }) => {
    await page.goto('/catalogo/');
    await page.waitForLoadState('networkidle');

    const editLink = page.locator('[data-testid^="catalogo-edit-"]').first();
    if (await editLink.count() === 0) {
      console.warn('Sin productos — se omite test de guardar cambios');
      return;
    }

    await editLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('editar-producto-page')).toBeVisible({ timeout: 15000 });

    // Click submit without changing anything (no-op update — exercises the PATCH endpoint)
    await page.getByTestId('edit-product-submit').click();

    // Should show success message (not an error)
    await expect(page.getByTestId('edit-product-success')).toBeVisible({ timeout: 10000 });
  });
});
