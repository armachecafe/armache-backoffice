import { test, expect } from '@playwright/test';
import { attachConsoleGuard, describeProblems } from '../../helpers/console-guard';

/**
 * PROD-SMOKE (backoffice): validates the Staff login UI flow against production Cognito.
 * Runs as GUEST (clears storageState) to exercise the login form.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('backoffice prod-smoke: login', () => {
  test('login form renders and authenticates a Staff user', async ({ page }) => {
    const email = process.env.STAFF_EMAIL;
    const password = process.env.STAFF_PASSWORD;
    test.skip(!email || !password, 'No STAFF_EMAIL/PASSWORD provided');

    const problems = attachConsoleGuard(page, test.info());
    await page.goto('/login/');

    await expect(page.getByTestId('login-email')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('login-email').fill(email!);
    await page.getByTestId('login-password').fill(password!);
    await page.getByTestId('login-submit').click();

    // Successful auth: redirected away from login, dashboard loads
    await page.waitForURL('**/dashboard/**', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });

    expect(problems.pageErrors, describeProblems(problems)).toHaveLength(0);
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });

  test('login form shows error on invalid credentials', async ({ page }) => {
    const problems = attachConsoleGuard(page, test.info());
    await page.goto('/login/');

    await expect(page.getByTestId('login-email')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('login-email').fill('no-such-staff@armachecafe.com');
    await page.getByTestId('login-password').fill('WrongPassword123!');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 15000 });
    expect(problems.serverErrors, describeProblems(problems)).toHaveLength(0);
  });
});
