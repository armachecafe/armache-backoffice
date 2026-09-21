import { test, expect } from '@playwright/test';

/**
 * PROD-SMOKE (backoffice) — DIAGNÓSTICO de CORS / errores de API por módulo.
 *
 * Para cada página del backoffice, captura las llamadas al API host y distingue:
 *   - CORS/network bloqueado  → page.on('requestfailed') (errorText, sin status)
 *   - Error HTTP (con CORS)    → page.on('response') con status >= 400
 *
 * Esto permite ver si el problema es realmente CORS (preflight/headers) o un
 * error de auth/handler (403/500) que el browser reporta como CORS.
 *
 * Usa la sesión autenticada (storageState) del global setup (pool staff).
 */
const API_HOST = process.env.API_URL ?? 'https://api.armachecafe.com';

const MODULE_ROUTES = [
  { path: '/dashboard/', label: 'Dashboard' },
  { path: '/pedidos/', label: 'Pedidos (order)' },
  { path: '/almacen/alertas/', label: 'Almacén - Alertas (wms)' },
  { path: '/almacen/recepciones/', label: 'Almacén - Recepciones (wms)' },
  { path: '/produccion/', label: 'Producción (mes)' },
  { path: '/catalogo/', label: 'Catálogo' },
  { path: '/reportes/', label: 'Reportes' },
  { path: '/trazabilidad/', label: 'Trazabilidad' },
];

test.describe('backoffice prod-smoke: API/CORS diagnostics', () => {
  for (const { path, label } of MODULE_ROUTES) {
    test(`${label} (${path}) — sin CORS/errores en llamadas al API`, async ({ page }) => {
      const corsOrNetwork: string[] = [];
      const httpErrors: string[] = [];

      page.on('requestfailed', (req) => {
        const url = req.url();
        if (url.startsWith(API_HOST)) {
          const reason = req.failure()?.errorText ?? 'unknown';
          corsOrNetwork.push(`${req.method()} ${url} → ${reason}`);
        }
      });

      page.on('response', (resp) => {
        const url = resp.url();
        if (url.startsWith(API_HOST) && resp.status() >= 400) {
          httpErrors.push(`${resp.status()} ${resp.request().method()} ${url}`);
        }
      });

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Report both categories on failure for precise diagnosis
      const report = [
        corsOrNetwork.length ? `CORS/Network bloqueado:\n  ${corsOrNetwork.join('\n  ')}` : '',
        httpErrors.length ? `Errores HTTP (con CORS):\n  ${httpErrors.join('\n  ')}` : '',
      ].filter(Boolean).join('\n');

      expect(corsOrNetwork, `Llamadas al API bloqueadas por CORS/red en ${label}:\n${report}`).toHaveLength(0);
      expect(httpErrors, `Llamadas al API con error HTTP en ${label}:\n${report}`).toHaveLength(0);
    });
  }
});

test.describe('backoffice prod-smoke: dynamic route regressions', () => {
  test('editar producto de catálogo — carga sin 400/VALIDATION_ERROR y sin redirigir a dashboard', async ({ page }) => {
    // Regression 1: /admin/catalog/products/{id} didn't exist (GET/PATCH) → 400 VALIDATION_ERROR.
    // Regression 2: CloudFront's 404 fallback served the ROOT index.html (RootPage), which
    // redirects to /dashboard/ for any unrecognized path — including a real, valid productId
    // that simply wasn't pre-rendered by generateStaticParams.
    const httpErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().startsWith(API_HOST) && resp.status() >= 400) {
        httpErrors.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
      }
    });

    await page.goto('/catalogo/');
    await page.waitForLoadState('networkidle');

    const editLink = page.locator('[data-testid^="catalogo-edit-"]').first();
    const hasProduct = await editLink.count() > 0;
    if (!hasProduct) {
      console.warn('Sin productos en el catálogo — se omite la verificación de edición.');
      return;
    }

    await editLink.click();
    await page.waitForLoadState('networkidle');

    // Regression 2 guard: must land on the edit page (static route + ?id= query param),
    // NOT get bounced to /dashboard/.
    await expect(page).toHaveURL(/\/catalogo\/editar\/\?id=.+/);
    await expect(page.getByTestId('editar-producto-page')).toBeVisible({ timeout: 15000 });

    // Regression 1 guard: the GET that populates the form must not be a VALIDATION_ERROR/400
    expect(httpErrors, `Llamadas con error al editar producto:\n${httpErrors.join('\n')}`).toHaveLength(0);
  });

  test('detalle de producto — formulario cargado con datos del API', async ({ page }) => {
    // Validates the full product edit view: navigates from the catalog list, lands on the
    // edit page, and verifies the form fields are populated with real data from the API.
    const httpErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().startsWith(API_HOST) && resp.status() >= 400) {
        httpErrors.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
      }
    });

    await page.goto('/catalogo/');
    await page.waitForLoadState('networkidle');

    const editLink = page.locator('[data-testid^="catalogo-edit-"]').first();
    const hasProduct = await editLink.count() > 0;
    if (!hasProduct) {
      console.warn('Sin productos en el catálogo — se omite la verificación de detalle de producto.');
      return;
    }

    await editLink.click();
    await page.waitForLoadState('networkidle');

    // Wait for the form to render with data (loading state must finish)
    await expect(page.getByTestId('editar-producto-page')).toBeVisible({ timeout: 15000 });

    // Form fields should be populated (non-empty) — proves the GET /admin/catalog/products/{id} worked
    const nameInput = page.getByTestId('edit-product-name');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).not.toHaveValue('');

    const priceInput = page.getByTestId('edit-product-price');
    await expect(priceInput).toBeVisible();
    await expect(priceInput).not.toHaveValue('');

    // Submit button is present and enabled
    const submitBtn = page.getByTestId('edit-product-submit');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();

    // No API errors during the whole flow
    expect(httpErrors, `Errores API en detalle de producto:\n${httpErrors.join('\n')}`).toHaveLength(0);
  });

  test('sidebar: Historial MES no deja "Producción" marcado activo (bug de prefijo)', async ({ page }) => {
    await page.goto('/produccion/');
    await page.getByTestId('sidebar-nav-produccion-historial').click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/produccion\/historial\/?$/);

    const produccionActive = await page.getByTestId('sidebar-nav-produccion').evaluate((el) => el.className.includes('bg-brand-light'));
    const historialActive = await page.getByTestId('sidebar-nav-produccion-historial').evaluate((el) => el.className.includes('bg-brand-light'));

    expect(produccionActive, '"Producción" no debería estar activo en /produccion/historial').toBe(false);
    expect(historialActive, '"Historial MES" debería estar activo en /produccion/historial').toBe(true);
  });
});
