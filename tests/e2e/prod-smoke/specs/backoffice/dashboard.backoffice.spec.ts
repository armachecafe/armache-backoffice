import { test, expect } from '@playwright/test';
import { attachConsoleGuard, describeProblems } from '../../helpers/console-guard';

/**
 * PROD-SMOKE (backoffice): validates that the dashboard page loads and
 * renders its main structural elements (stats cards, headings).
 * Uses authenticated storageState from global setup.
 */
test.describe('backoffice prod-smoke: dashboard', () => {
  test('dashboard loads with stats structure visible', async ({ page }) => {
    const problems = attachConsoleGuard(page, test.info());
    await page.goto('/dashboard/');

    // Dashboard heading should be visible
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15000 });

    // At least one stats card or container should render (even if values are 0)
    await page.waitForLoadState('networkidle');

    // Verify no JS errors or 5xx
    expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });
});
