import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for the backoffice orders list page (/pedidos/).
 */
export class BackofficeOrdersPage {
  readonly heading: Locator;
  readonly ordersTable: Locator;
  readonly loadingIndicator: Locator;

  constructor(private page: Page) {
    this.heading = page.getByRole('heading', { name: /pedidos/i });
    this.ordersTable = page.getByTestId('orders-table');
    this.loadingIndicator = page.locator('[class*="animate-pulse"]');
  }

  async goto() {
    await this.page.goto('/pedidos/');
  }
}
