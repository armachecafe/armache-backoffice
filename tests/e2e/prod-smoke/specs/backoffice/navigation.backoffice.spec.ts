import { test, expect } from '@playwright/test';
import { attachConsoleGuard, describeProblems } from '../../helpers/console-guard';

/**
 * PROD-SMOKE (backoffice): validates that main backoffice routes load without
 * 5xx errors or JS exceptions. Uses authenticated storageState from global setup.
 */
const ROUTES = [
  { path: '/dashboard/', label: 'Dashboard' },
  { path: '/pedidos/', label: 'Pedidos' },
  { path: '/almacen/recepciones/', label: 'Almacén - Recepciones' },
  { path: '/produccion/', label: 'Producción' },
  { path: '/catalogo/', label: 'Catálogo' },
  { path: '/reportes/', label: 'Reportes' },
  { path: '/trazabilidad/', label: 'Trazabilidad' },
];

test.describe('backoffice prod-smoke: navigation', () => {
  for (const { path, label } of ROUTES) {
    test(`${label} (${path}) loads cleanly`, async ({ page }) => {
      const problems = attachConsoleGuard(page, test.info());
      const resp = await page.goto(path);
      expect(resp?.status(), `${path} HTTP status`).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
      expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
    });
  }
});
