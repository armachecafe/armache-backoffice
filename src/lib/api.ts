/**
 * Backoffice API client — all calls authenticated via Backoffice Pool token.
 *
 * CONTRACT-FIRST: openapi/admin.yaml (via @armache/openapi-client/admin) is the
 * SINGLE SOURCE OF TRUTH for /backoffice/* request and response shapes. This
 * module imports the generated components['schemas'] as `ContractSchemas` and
 * maps them to the backoffice's UI-facing types in ONE place, so no UI component
 * changes when the wire changes.
 */
import { getIdToken } from '@/lib/auth';
import type { components } from '@armache/openapi-client/admin';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.armachecafe.com';

// ---------------------------------------------------------------------------
// Contract types (backend truth, generated from openapi/admin.yaml)
// ---------------------------------------------------------------------------
type ContractSchemas = components['schemas'];

// ---------------------------------------------------------------------------
// Direct re-exports — contract shape already equals the UI shape
// ---------------------------------------------------------------------------
export type BackofficePermissions = ContractSchemas['BackofficePermissions'];
export type DashboardStats = ContractSchemas['BackofficeDashboardStats'];
export type ProductionOrder = ContractSchemas['ProductionOrder'];

// ---------------------------------------------------------------------------
// UI-facing types DERIVED from the contract (never independently declared)
// ---------------------------------------------------------------------------

export type BackofficeOrderSummary = Omit<ContractSchemas['BackofficeOrderSummary'], 'status'> & {
  status: OrderStatus;
  customerName?: string;
  customerEmail?: string;
  type: 'B2C' | 'B2B';
};

export type StockAlert = ContractSchemas['StockAlert'] & {
  locationId: string;
  locationName: string;
  createdAt: string;
};

// Presign grant — three-way naming divergence (wire `headers`, UI `signedHeaders`,
// legacy alias `requiredHeaders`). The ONLY place this rename exists.
type ContractUploadGrant = ContractSchemas['BackofficeProductImageUploadGrant'];

/**
 * DEPRECATED alias tolerance. No backend under services/ emits `requiredHeaders`
 * (verified at design time). Kept as a defensive runtime read for a hypothetical
 * older deployed catalog-backoffice-images Lambda. Delete this widening — and the
 * `??` below — once the deployed Lambda version is confirmed to emit `headers`.
 */
type WireUploadGrant = Omit<ContractUploadGrant, 'headers'> & {
  headers?: Record<string, string>;
  requiredHeaders?: Record<string, string>;
};

/**
 * UI-facing grant. `signedHeaders` is the UI name for the wire's `headers`;
 * ~UI call sites are unchanged by this migration.
 */
export interface ProductImageUploadGrant extends ContractUploadGrant {
  signedHeaders: Record<string, string>;
}

/** Wire -> UI. The ONLY place the headers/signedHeaders rename exists. */
export function normalizeUploadGrant(wire: WireUploadGrant): ProductImageUploadGrant {
  const signedHeaders = wire.requiredHeaders ?? wire.headers;
  if (!signedHeaders || Object.keys(signedHeaders).length === 0) {
    throw new Error('La autorización de carga no incluyó los headers requeridos');
  }
  return { ...wire, signedHeaders } as ProductImageUploadGrant;
}

// ---------------------------------------------------------------------------
// Hand-written UI types (contract shape diverges — kept unchanged so consumers
// do not break; migrate field-by-field once the backend aligns).
// ---------------------------------------------------------------------------

export type OrderStatus = 'CONFIRMED' | 'PREPARING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface BackofficeOrderDetail {
  orderId: string;
  orderCode: string;
  status: OrderStatus;
  totalCents: number;
  shippingCents: number;
  items: { sku: string; name: string; quantity: number; priceCents: number; subtotalCents: number }[];
  timeline: { status: string; timestamp: string; actor?: string }[];
  notes: { noteId: string; text: string; author: string; createdAt: string }[];
  returns: { returnId: string; status: string; items: { sku: string; quantity: number; reason: string }[] }[];
  customer: { name: string; email: string; phone?: string };
  shippingAddress?: { recipientName: string; street: string; city: string; department: string; province: string };
  paymentMethod?: string;
  trackingNumber?: string;
  courierName?: string;
  createdAt: string;
}

export interface PurchaseOrder {
  poId: string;
  poCode: string;
  supplier?: string;
  status: 'OPEN' | 'PARTIAL' | 'CLOSED';
  lines: { sku: string; productName: string; orderedQty: number; receivedQty: number; unit: string }[];
  createdAt: string;
}

export interface Transfer {
  transferId: string;
  fromLocation: string;
  toLocation: string;
  status: 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  items: { sku: string; productName: string; quantity: number; lotCode?: string }[];
  createdAt: string;
}

export type BackofficeProductImageStatus = 'CONFIRMING' | 'ACTIVE' | 'DELETING';

export interface BackofficeProductImage {
  imageId: string;
  url: string;
  thumbnailUrl: string;
  mediumUrl: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
  status: BackofficeProductImageStatus;
}

export interface BackofficeProduct {
  productId: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  categoryId: string;
  categoryName?: string;
  priceCents: number;
  costCents?: number;
  thumbnailUrl?: string;
  images?: BackofficeProductImage[];
  inStock: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  published: boolean;
  variants?: { variantId: string; name: string; priceCents: number; inStock: boolean }[];
  createdAt: string;
}

export interface CreateProductInput {
  name: string;
  slug: string;
  description?: string;
  categoryId: string;
  priceCents: number;
  costCents?: number;
  lowStockThreshold?: number;
  variants?: { name: string; priceCents: number }[];
  coffeeAttributes?: { origin?: string; variety?: string; process?: string; roastLevel?: string; altitude?: number; flavorNotes?: string[] };
}

export interface CreateB2BOrderInput {
  clientName: string;
  clientCompany: string;
  clientContact: { name: string; email: string; phone: string };
  items: { sku: string; productName: string; quantity: number; unitPrice: number }[];
  shippingAddress: { street: string; district: string; province: string; department: string; postalCode?: string; reference?: string } | null;
  shippingMethod: { type: 'PICKUP'; pickupLocationId: string; pickupLocationName: string; cost: 0 } | { type: 'DELIVERY'; zoneId: string; zoneName: string; cost: number; estimatedDays: number };
}

export interface StockReportRow {
  sku: string;
  productName: string;
  locationId: string;
  locationName: string;
  quantity: number;
  threshold: number;
  isLow: boolean;
}

export interface SalesReport {
  totalOrderCount: number;
  totalRevenueCents: number;
  averageTicketCents: number;
  ordersByDay: { date: string; count: number; revenueCents: number }[];
}

export interface ProductionReport {
  totalOrders: number;
  totalProducedKg: number;
  totalWasteKg: number;
  averageWastePercent: number;
  byProcess: { process: string; count: number; producedKg: number; wasteKg: number }[];
}

export interface LotTraceability {
  lot: { lotId: string; lotCode: string; sku: string; productName: string; createdAt: string };
  backward: { ancestorLotId: string; ancestorLotCode: string; ancestorSku: string; relationship: string }[];
  forward: { orderId: string; orderCode: string; customerName?: string; linkedAt: string }[];
}

export interface LotSearchResult {
  lotId: string;
  lotCode: string;
  sku: string;
  productName: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchBackofficeApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new Error('No backoffice session');

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error: ${res.status} ${res.statusText} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- API Methods ---

export const backofficeApi = {
  // Permissions
  getMyPermissions: () => fetchBackofficeApi<BackofficePermissions>('/backoffice/me/permissions'),

  // Dashboard
  getDashboardStats: () => fetchBackofficeApi<DashboardStats>('/backoffice/dashboard/stats'),

  // Orders
  listOrders: (params?: { status?: string; search?: string; pageSize?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.cursor) qs.set('cursor', params.cursor);
    return fetchBackofficeApi<{ items: BackofficeOrderSummary[]; nextCursor?: string }>(`/backoffice/orders?${qs}`);
  },
  getOrder: (orderId: string) => fetchBackofficeApi<BackofficeOrderDetail>(`/backoffice/orders/${orderId}`),
  transitionOrder: (orderId: string, newStatus: OrderStatus, data?: { trackingNumber?: string; courierName?: string }) =>
    fetchBackofficeApi<{ success: boolean }>(`/backoffice/orders/${orderId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ newStatus, ...data }),
    }),
  addOrderNote: (orderId: string, text: string) =>
    fetchBackofficeApi<{ noteId: string }>(`/backoffice/orders/${orderId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // WMS
  getStockAlerts: () => fetchBackofficeApi<{ alerts: StockAlert[] }>('/backoffice/wms/alerts').then((r) => r.alerts),
  listPurchaseOrders: () => fetchBackofficeApi<{ items: PurchaseOrder[] }>('/backoffice/wms/purchase-orders').then((r) => r.items),
  createReception: (poId: string, lines: { sku: string; receivedQty: number }[], note?: string) =>
    fetchBackofficeApi<{ success: boolean }>('/backoffice/wms/receptions', {
      method: 'POST',
      body: JSON.stringify({ poId, lines, note }),
    }),
  listTransfers: () => fetchBackofficeApi<{ items: Transfer[] }>('/backoffice/wms/transfers').then((r) => r.items),
  createTransfer: (data: { fromLocation: string; toLocation: string; items: { sku: string; quantity: number; lotCode?: string }[] }) =>
    fetchBackofficeApi<{ transferId: string }>('/backoffice/wms/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  confirmTransfer: (transferId: string) =>
    fetchBackofficeApi<{ success: boolean }>(`/backoffice/wms/transfers/${transferId}/confirm`, { method: 'POST' }),

  // MES
  listProductionOrders: (params?: { status?: string; process?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.process) qs.set('process', params.process);
    return fetchBackofficeApi<{ items: ProductionOrder[] }>(`/backoffice/mes/orders?${qs}`).then((r) => r.items);
  },
  createProductionOrder: (data: { process: string; inputSku: string; inputLotCode: string; inputQtyKg: number }) =>
    fetchBackofficeApi<{ orderId: string }>('/backoffice/mes/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  closeProductionOrder: (orderId: string, data: { outputQtyKg: number; wasteKg: number }) =>
    fetchBackofficeApi<{ outputLotCode: string }>(`/backoffice/mes/orders/${orderId}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getProductionHistory: (params?: { process?: string; dateFrom?: string; dateTo?: string; pageSize?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (params?.process) qs.set('process', params.process);
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.cursor) qs.set('cursor', params.cursor);
    return fetchBackofficeApi<{ items: ProductionOrder[]; nextCursor?: string }>(`/backoffice/mes/history?${qs}`);
  },

  // --- Ronda 2: Catalog Admin (BACK-02) ---
  listProducts: (params?: { category?: string; search?: string; pageSize?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.cursor) qs.set('cursor', params.cursor);
    return fetchBackofficeApi<{ items: BackofficeProduct[]; nextCursor?: string }>(`/backoffice/catalog/products?${qs}`);
  },
  getProduct: (productId: string) => fetchBackofficeApi<BackofficeProduct>(`/backoffice/catalog/products/${productId}`),
  createProduct: (data: CreateProductInput) =>
    fetchBackofficeApi<{ productId: string }>('/backoffice/catalog/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (productId: string, data: Partial<CreateProductInput>) =>
    fetchBackofficeApi<{ success: boolean }>(`/backoffice/catalog/products/${productId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  unpublishProduct: (productId: string) =>
    fetchBackofficeApi<{ success: boolean }>(`/backoffice/catalog/products/${productId}/unpublish`, { method: 'POST' }),
  requestProductImageUpload: async (productId: string, data: { contentType: string; sizeBytes: number }) => {
    const wire = await fetchBackofficeApi<WireUploadGrant>(
      `/backoffice/catalog/products/${productId}/images/presign`,
      { method: 'POST', body: JSON.stringify(data) },
    );
    return normalizeUploadGrant(wire);
  },
  confirmProductImage: (productId: string, imageId: string) =>
    fetchBackofficeApi<BackofficeProductImage>(`/backoffice/catalog/products/${productId}/images/confirm`, {
      method: 'POST',
      body: JSON.stringify({ imageId }),
    }),
  deleteProductImage: (productId: string, imageId: string) =>
    fetchBackofficeApi<void>(`/backoffice/catalog/products/${productId}/images/${encodeURIComponent(imageId)}`, {
      method: 'DELETE',
    }),

  // --- Ronda 2: B2B Orders (BACK-04) ---
  createB2BOrder: (data: CreateB2BOrderInput) =>
    fetchBackofficeApi<{ orderId: string; orderCode: string }>('/backoffice/orders/b2b', { method: 'POST', body: JSON.stringify(data) }),

  // --- Ronda 2: Reports (BACK-05) ---
  getStockReport: () => fetchBackofficeApi<{ items: StockReportRow[] }>('/backoffice/reports/stock').then((r) => r.items),
  getSalesReport: (params: { dateFrom: string; dateTo: string }) => {
    const qs = new URLSearchParams(params);
    return fetchBackofficeApi<SalesReport>(`/backoffice/reports/sales?${qs}`);
  },
  getProductionReport: (params: { dateFrom: string; dateTo: string }) => {
    const qs = new URLSearchParams(params);
    return fetchBackofficeApi<ProductionReport>(`/backoffice/reports/production?${qs}`);
  },

  // --- Ronda 2: Returns (WMS-06) ---
  createReturn: (orderId: string, items: { sku: string; quantity: number; reason: string }[]) =>
    fetchBackofficeApi<{ returnId: string }>(`/backoffice/orders/${orderId}/returns`, { method: 'POST', body: JSON.stringify({ items }) }),
  confirmReturnReception: (returnId: string) =>
    fetchBackofficeApi<{ success: boolean }>(`/backoffice/wms/returns/${returnId}/confirm`, { method: 'POST' }),

  // --- Ronda 2: Traceability Admin (TRZ-02) ---
  getLotTraceability: (lotId: string) => fetchBackofficeApi<LotTraceability>(`/backoffice/traceability/lots/${lotId}`),
  searchLots: (query: string) =>
    fetchBackofficeApi<{ items: LotSearchResult[] }>(`/backoffice/traceability/lots?search=${encodeURIComponent(query)}`).then((r) => r.items),
};
