import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for the backoffice dashboard (/dashboard/).
 */
export class BackofficeDashboardPage {
  readonly heading: Locator;
  readonly statsSection: Locator;
  readonly stockAlertsSection: Locator;

  constructor(private page: Page) {
    this.heading = page.getByRole('heading', { name: /dashboard/i });
    this.statsSection = page.getByTestId('dashboard-stats');
    this.stockAlertsSection = page.getByTestId('dashboard-stock-alerts');
  }

  async goto() {
    await this.page.goto('/dashboard/');
  }
}
