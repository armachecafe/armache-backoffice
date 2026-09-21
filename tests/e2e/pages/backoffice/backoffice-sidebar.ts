import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for the backoffice sidebar navigation.
 */
export class BackofficeSidebar {
  readonly dashboardLink: Locator;
  readonly pedidosLink: Locator;
  readonly almacenLink: Locator;
  readonly produccionLink: Locator;
  readonly catalogoLink: Locator;
  readonly reportesLink: Locator;
  readonly trazabilidadLink: Locator;

  constructor(private page: Page) {
    this.dashboardLink = page.getByRole('link', { name: /dashboard/i });
    this.pedidosLink = page.getByRole('link', { name: /pedidos/i });
    this.almacenLink = page.getByRole('link', { name: /almac[eé]n/i });
    this.produccionLink = page.getByRole('link', { name: /producci[oó]n/i });
    this.catalogoLink = page.getByRole('link', { name: /cat[aá]logo/i });
    this.reportesLink = page.getByRole('link', { name: /reportes/i });
    this.trazabilidadLink = page.getByRole('link', { name: /trazabilidad/i });
  }

  async navigateTo(section: 'dashboard' | 'pedidos' | 'almacen' | 'produccion' | 'catalogo' | 'reportes' | 'trazabilidad') {
    const links: Record<string, Locator> = {
      dashboard: this.dashboardLink,
      pedidos: this.pedidosLink,
      almacen: this.almacenLink,
      produccion: this.produccionLink,
      catalogo: this.catalogoLink,
      reportes: this.reportesLink,
      trazabilidad: this.trazabilidadLink,
    };
    await links[section].click();
  }
}
