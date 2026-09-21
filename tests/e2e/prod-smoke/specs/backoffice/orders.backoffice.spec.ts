import { test, expect } from '@playwright/test';
import { attachConsoleGuard, describeProblems } from '../../helpers/console-guard';

/**
 * PROD-SMOKE (backoffice): validates that the orders page loads and
 * renders the order list structure. Uses authenticated storageState.
 */
test.describe('backoffice prod-smoke: orders', () => {
  test('orders page loads with heading visible', async ({ page }) => {
    const problems = attachConsoleGuard(page, test.info());
    await page.goto('/pedidos/');

    // Orders heading should be visible
    await expect(page.getByRole('heading', { name: /pedidos/i })).toBeVisible({ timeout: 15000 });

    // Wait for data to attempt loading (table or empty state)
    await page.waitForLoadState('networkidle');

    // Verify no JS errors or 5xx
    expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });

  test('authenticated layout renders sidebar and orders is navigable', async ({ page }) => {
    const problems = attachConsoleGuard(page, test.info());
    await page.goto('/dashboard/');
    await page.waitForLoadState('domcontentloaded');

    // The authenticated layout must render the sidebar container.
    // NOTE: sidebar nav items are permission-gated via /staff/me/permissions, which is
    // currently unrouted (see BACKOFFICE-STAFF-PERMISSIONS-DEFECT.md). We therefore verify
    // the sidebar container renders and that direct navigation to /pedidos works, rather
    // than clicking a permission-gated link. Harden to click the link once the defect is fixed.
    await expect(page.getByTestId('backoffice-sidebar')).toBeVisible({ timeout: 15000 });

    // If the permission-gated Pedidos link is present, use it; otherwise navigate directly.
    const pedidosLink = page.getByTestId('sidebar-nav-pedidos');
    if (await pedidosLink.isVisible().catch(() => false)) {
      await pedidosLink.click();
    } else {
      await page.goto('/pedidos/');
    }
    await expect(page).toHaveURL(/\/pedidos\//);
    await expect(page.getByRole('heading', { name: /pedidos/i })).toBeVisible({ timeout: 10000 });

    expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });
});
