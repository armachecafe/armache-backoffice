import { test, expect } from '@playwright/test';

/**
 * PROD-SMOKE (backoffice): verifies the ADMIN API calls made by each module page
 * do NOT return 403 (authorizer denial) — the systemic defect fixed by
 * backoffice-admin-api-fix. A 403 on /admin/* or /staff/* would previously appear
 * to the browser as a CORS error and leave the module non-functional.
 *
 * Uses authenticated storageState from global setup.
 */
const MODULE_ROUTES = [
  { path: '/dashboard/', label: 'Dashboard' },
  { path: '/pedidos/', label: 'Pedidos' },
  { path: '/almacen/recepciones/', label: 'Almacén' },
  { path: '/produccion/', label: 'Producción' },
  { path: '/catalogo/', label: 'Catálogo' },
  { path: '/reportes/', label: 'Reportes' },
  { path: '/trazabilidad/', label: 'Trazabilidad' },
];

test.describe('backoffice prod-smoke: admin API not 403', () => {
  for (const { path, label } of MODULE_ROUTES) {
    test(`${label} (${path}) — no 403 on admin/staff API calls`, async ({ page }) => {
      const forbidden: string[] = [];

      page.on('response', (resp) => {
        const url = resp.url();
        if ((url.includes('/admin/') || url.includes('/staff/')) && resp.status() === 403) {
          forbidden.push(`403 ${resp.request().method()} ${url}`);
        }
      });

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      expect(forbidden, `Admin API returned 403 (authorizer denial) on ${label}:\n${forbidden.join('\n')}`).toHaveLength(0);
    });
  }
});
