import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for BACKOFFICE PROD-SMOKE: runs against the REAL production
 * backoffice admin panel (https://admin.armachecafe.com) with NO network mocks.
 *
 * Validates: Staff login, navigation, dashboard, orders — detecting JS errors,
 * 5xx responses, and rendering failures in the deployed backoffice.
 *
 * Run explicitly:
 *   npx playwright test --config=playwright.backoffice.config.ts
 *
 * Required env vars for full execution:
 *   STAFF_EMAIL     — Staff pool user email
 *   STAFF_PASSWORD  — Staff pool user password
 *
 * Optional env vars:
 *   BACKOFFICE_URL            (default: https://admin.armachecafe.com)
 *   BACKOFFICE_STORAGE_STATE  (default: tests/e2e/prod-smoke/.auth/backoffice-state.json)
 */
const BASE_URL = process.env.BACKOFFICE_URL ?? 'https://admin.armachecafe.com';
const IS_LOCAL = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');

// Unified per-run output: the orchestrator exports PW_RESULTS_DIR=tests/results/<runId>/playwright
// so k6 and Playwright artifacts for the same run live under one tree. Falls back to
// playwright-report/ for standalone runs.
const RESULTS_DIR = process.env.PW_RESULTS_DIR ?? 'playwright-report';

export default defineConfig({
  testDir: './tests/e2e/prod-smoke/specs/backoffice',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  outputDir: `${RESULTS_DIR}/backoffice-prod-smoke-artifacts`,
  reporter: [['list'], ['json', { outputFile: `${RESULTS_DIR}/backoffice-prod-smoke-results.json` }]],

  globalSetup: './tests/e2e/prod-smoke/backoffice-global-setup.ts',

  use: {
    baseURL: BASE_URL,
    storageState: process.env.BACKOFFICE_STORAGE_STATE ?? 'tests/e2e/prod-smoke/.auth/backoffice-state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // When targeting localhost, auto-start the backoffice dev server (port 3001).
  // Against prod (admin.armachecafe.com) no webServer is used.
  ...(IS_LOCAL
    ? {
        webServer: {
          command: 'pnpm --filter @armache/backoffice dev',
          url: 'http://localhost:3001/login/',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),

  projects: [
    {
      name: 'backoffice-prod-smoke',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
