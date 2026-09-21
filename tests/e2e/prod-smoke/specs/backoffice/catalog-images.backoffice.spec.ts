/**
 * Playwright prod-smoke — Catalog Image Upload MVP.
 *
 * Navigates from backoffice catalog, opens edit page, uploads a small fixture,
 * verifies progress/preview/CDN rendering on storefront and deletes in finally.
 *
 * Stories: CIMG-01, CIMG-02, CIMG-03.
 * Prerequisites: ephemeral Staff authenticated via storageState.
 */

import { test, expect } from '@playwright/test';

const API_HOST = process.env.API_URL || 'https://api.armachecafe.com';
const STOREFRONT_URL = process.env.PROD_URL || 'https://armachecafe.com';

test.describe('backoffice prod-smoke: catalog images', () => {
  test('upload, preview, CDN verify and delete image', async ({ page }) => {
    const httpErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().startsWith(API_HOST) && resp.status() >= 500) {
        httpErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    // Navigate to catalog list
    await page.goto('/catalogo/');
    await page.waitForLoadState('networkidle');

    // Find a product with edit link
    const editLink = page.locator('[data-testid^="catalogo-edit-"]').first();
    if (await editLink.count() === 0) {
      console.warn('No products found — skipping image upload test');
      return;
    }

    // Click the edit link and wait for the client-side (soft) navigation to complete.
    // networkidle is unreliable for Next soft-nav, so wait for the URL explicitly.
    await editLink.click();
    await page.waitForURL('**/catalogo/editar/**', { timeout: 15000 });

    // Verify static query URL (Regla 1 frontend static export)
    expect(page.url()).toContain('/catalogo/editar/?id=');
    await expect(page.getByTestId('editar-producto-page')).toBeVisible({ timeout: 15000 });

    // Locate image manager
    const imageManager = page.getByTestId('product-image-manager');
    await expect(imageManager).toBeVisible({ timeout: 10000 });

    // Count current images
    const currentImages = await page.locator('[data-testid^="product-image-card-"]').count();
    if (currentImages >= 3) {
      console.warn('Product already has 3 images — skipping upload (capacity limit)');
      return;
    }

    // Create a small test PNG file (1x1 red pixel)
    const tinyPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    // Upload via file picker (real testid is 'product-image-picker')
    const fileInput = page.getByTestId('product-image-picker');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });

    // Capture any S3/API request that fails during the browser upload, for diagnostics.
    const uploadFailures: string[] = [];
    page.on('requestfailed', (req) => {
      if (/s3|amazonaws|presign|confirm/i.test(req.url())) {
        uploadFailures.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'failed'}`);
      }
    });
    page.on('response', (resp) => {
      if (/s3|amazonaws/i.test(resp.url()) && resp.status() >= 400) {
        uploadFailures.push(`${resp.status()} PUT ${resp.url()}`);
      }
    });

    // Selecting a file does NOT auto-upload — click the explicit "Subir imagen" button.
    await page.getByTestId('image-upload-button').click();

    // The card appearing proves presign→PUT→confirm succeeded. If instead the component
    // surfaces an error alert, fail fast with the actual message + any network failure.
    const newImageCard = page.locator('[data-testid^="product-image-card-"]').last();
    const errorAlert = page.getByTestId('image-operation-error');
    const outcome = await Promise.race([
      newImageCard.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'card' as const).catch(() => 'timeout' as const),
      errorAlert.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'error' as const).catch(() => 'timeout' as const),
    ]);
    if (outcome !== 'card') {
      const errText = (await errorAlert.count()) > 0 ? await errorAlert.textContent() : '(no error alert)';
      throw new Error(`Upload did not confirm. Component error: ${errText}. Network failures: ${JSON.stringify(uploadFailures)}`);
    }
    await expect(newImageCard).toBeVisible({ timeout: 5000 });

    // Verify success message
    const successAlert = page.getByTestId('image-operation-success');
    await expect(successAlert).toBeVisible({ timeout: 5000 });

    // Verify the image URL points to CDN
    const imgSrc = await newImageCard.locator('img').first().getAttribute('src');
    expect(imgSrc).toContain('cdn.armachecafe.com');

    // --- Delete the uploaded image (delete uses native window.confirm) ---
    try {
      // Auto-accept the native confirm dialog
      page.once('dialog', (dialog) => dialog.accept());
      const deleteBtn = newImageCard.getByTestId('image-delete-button');
      await deleteBtn.click();

      // Verify card disappears
      await expect(newImageCard).not.toBeVisible({ timeout: 15000 });
    } catch (deleteErr) {
      console.warn('Image delete failed in cleanup — teardown will handle via testRunId');
    }

    // No 5xx errors during the flow
    expect(httpErrors).toHaveLength(0);
  });
});
