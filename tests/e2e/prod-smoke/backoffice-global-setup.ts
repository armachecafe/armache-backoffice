import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Global setup for backoffice prod-smoke: performs a REAL Cognito Backoffice login
 * through the production backoffice UI and persists storageState for reuse.
 *
 * Requires env vars:
 *   BACKOFFICE_URL        (default https://admin.armachecafe.com)
 *   BACKOFFICE_EMAIL      (Backoffice pool user email)
 *   BACKOFFICE_PASSWORD   (Backoffice pool user password)
 *   BACKOFFICE_STORAGE_STATE (default tests/e2e/prod-smoke/.auth/backoffice-state.json)
 *
 * If credentials are absent, writes an empty storageState so the login spec
 * can still validate form rendering (will skip auth-dependent specs).
 */
async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.BACKOFFICE_URL ?? 'https://admin.armachecafe.com';
  const statePath = process.env.BACKOFFICE_STORAGE_STATE ?? 'tests/e2e/prod-smoke/.auth/backoffice-state.json';
  const email = process.env.BACKOFFICE_EMAIL;
  const password = process.env.BACKOFFICE_PASSWORD;

  mkdirSync(dirname(statePath), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  if (email && password) {
    try {
      await page.goto('/login/');
      await page.getByTestId('login-email').waitFor({ state: 'visible', timeout: 15000 });
      await page.getByTestId('login-email').fill(email);
      await page.getByTestId('login-password').fill(password);
      await page.getByTestId('login-submit').click();
      // Wait for redirect to dashboard (successful auth: /login → / → /dashboard)
      await page.waitForURL('**/dashboard/**', { timeout: 20000 });
      console.log(`[backoffice-prod-smoke] Logged in as ${email}`);
    } catch (err) {
      console.warn(`[backoffice-prod-smoke] UI login failed, saving guest state: ${(err as Error).message}`);
    }
  } else {
    console.warn('[backoffice-prod-smoke] No BACKOFFICE_EMAIL/PASSWORD — saving guest storageState.');
  }

  await context.storageState({ path: statePath });
  await browser.close();
}

export default globalSetup;
