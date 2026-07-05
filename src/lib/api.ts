/**
 * Backoffice API client — all calls authenticated via Staff Pool token.
 */
import { getIdToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.armachecafe.com';

async function fetchStaffApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new Error('No staff session');

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
  return res.json() as Promise<T>;
}

// --- Types ---

export type OrderStatus = 'CONFIRMED' | 'PREPARING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface AdminOrderSummary {
  orderId: string;
  orderCode: string;
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  customerName?: string;
  customerEmail?: string;
  type: 'B2C' | 'B2B';
  createdAt: string;
}

export interface AdminOrderDetail {
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

export interface DashboardStats {
  todaySalesCents: number;
  todayOrderCount: number;
  ordersByStatus: Record<string, number>;
  todayProductionKg: number;
  todayWasteKg: number;
}

export interface StockAlert {
  sku: string;
  productName: string;
  locationId: string;
  locationName: string;
  currentStock: number;
  threshold: number;
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

export interface ProductionOrder {
  orderId: string;
  process: 'ROASTING' | 'GRINDING' | 'PACKAGING';
  status: 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
  inputSku: string;
  inputLotCode: string;
  inputQtyKg: number;
  outputQtyKg?: number;
  wasteKg?: number;
  outputLotCode?: string;
  operator: string;
  startedAt: string;
  closedAt?: string;
}

export interface StaffPermissions {
  role: string;
  permissions: string[];
}

// --- Ronda 2 Types ---

export interface AdminProduct {
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
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  items: { sku: string; name: string; quantity: number; priceCents: number }[];
  shippingAddress?: { recipientName: string; street: string; city: string; department: string; province: string };
  notes?: string;
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

// --- API Methods ---

export const staffApi = {
  // Permissions
  getMyPermissions: () => fetchStaffApi<StaffPermissions>('/staff/me/permissions'),

  // Dashboard
  getDashboardStats: () => fetchStaffApi<DashboardStats>('/admin/dashboard/stats'),

  // Orders
  listOrders: (params?: { status?: string; search?: string; pageSize?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.cursor) qs.set('cursor', params.cursor);
    return fetchStaffApi<{ items: AdminOrderSummary[]; nextCursor?: string }>(`/admin/orders?${qs}`);
  },
  getOrder: (orderId: string) => fetchStaffApi<AdminOrderDetail>(`/admin/orders/${orderId}`),
  transitionOrder: (orderId: string, newStatus: OrderStatus, data?: { trackingNumber?: string; courierName?: string }) =>
    fetchStaffApi<{ success: boolean }>(`/admin/orders/${orderId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ newStatus, ...data }),
    }),
  addOrderNote: (orderId: string, text: string) =>
    fetchStaffApi<{ noteId: string }>(`/admin/orders/${orderId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // WMS
  getStockAlerts: () => fetchStaffApi<{ alerts: StockAlert[] }>('/admin/wms/alerts').then((r) => r.alerts),
  listPurchaseOrders: () => fetchStaffApi<{ items: PurchaseOrder[] }>('/admin/wms/purchase-orders').then((r) => r.items),
  createReception: (poId: string, lines: { sku: string; receivedQty: number }[], note?: string) =>
    fetchStaffApi<{ success: boolean }>('/admin/wms/receptions', {
      method: 'POST',
      body: JSON.stringify({ poId, lines, note }),
    }),
  listTransfers: () => fetchStaffApi<{ items: Transfer[] }>('/admin/wms/transfers').then((r) => r.items),
  createTransfer: (data: { fromLocation: string; toLocation: string; items: { sku: string; quantity: number; lotCode?: string }[] }) =>
    fetchStaffApi<{ transferId: string }>('/admin/wms/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  confirmTransfer: (transferId: string) =>
    fetchStaffApi<{ success: boolean }>(`/admin/wms/transfers/${transferId}/confirm`, { method: 'POST' }),

  // MES
  listProductionOrders: (params?: { status?: string; process?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.process) qs.set('process', params.process);
    return fetchStaffApi<{ items: ProductionOrder[] }>(`/admin/mes/orders?${qs}`).then((r) => r.items);
  },
  createProductionOrder: (data: { process: string; inputSku: string; inputLotCode: string; inputQtyKg: number }) =>
    fetchStaffApi<{ orderId: string }>('/admin/mes/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  closeProductionOrder: (orderId: string, data: { outputQtyKg: number; wasteKg: number }) =>
    fetchStaffApi<{ outputLotCode: string }>(`/admin/mes/orders/${orderId}/close`, {
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
    return fetchStaffApi<{ items: ProductionOrder[]; nextCursor?: string }>(`/admin/mes/history?${qs}`);
  },

  // --- Ronda 2: Catalog Admin (BACK-02) ---
  listProducts: (params?: { category?: string; search?: string; pageSize?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.cursor) qs.set('cursor', params.cursor);
    return fetchStaffApi<{ items: AdminProduct[]; nextCursor?: string }>(`/admin/catalog/products?${qs}`);
  },
  getProduct: (productId: string) => fetchStaffApi<AdminProduct>(`/admin/catalog/products/${productId}`),
  createProduct: (data: CreateProductInput) =>
    fetchStaffApi<{ productId: string }>('/admin/catalog/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (productId: string, data: Partial<CreateProductInput>) =>
    fetchStaffApi<{ success: boolean }>(`/admin/catalog/products/${productId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  unpublishProduct: (productId: string) =>
    fetchStaffApi<{ success: boolean }>(`/admin/catalog/products/${productId}/unpublish`, { method: 'POST' }),

  // --- Ronda 2: B2B Orders (BACK-04) ---
  createB2BOrder: (data: CreateB2BOrderInput) =>
    fetchStaffApi<{ orderId: string; orderCode: string }>('/admin/orders/b2b', { method: 'POST', body: JSON.stringify(data) }),

  // --- Ronda 2: Reports (BACK-05) ---
  getStockReport: () => fetchStaffApi<{ items: StockReportRow[] }>('/admin/reports/stock').then((r) => r.items),
  getSalesReport: (params: { dateFrom: string; dateTo: string }) => {
    const qs = new URLSearchParams(params);
    return fetchStaffApi<SalesReport>(`/admin/reports/sales?${qs}`);
  },
  getProductionReport: (params: { dateFrom: string; dateTo: string }) => {
    const qs = new URLSearchParams(params);
    return fetchStaffApi<ProductionReport>(`/admin/reports/production?${qs}`);
  },

  // --- Ronda 2: Returns (WMS-06) ---
  createReturn: (orderId: string, items: { sku: string; quantity: number; reason: string }[]) =>
    fetchStaffApi<{ returnId: string }>(`/admin/orders/${orderId}/returns`, { method: 'POST', body: JSON.stringify({ items }) }),
  confirmReturnReception: (returnId: string) =>
    fetchStaffApi<{ success: boolean }>(`/admin/wms/returns/${returnId}/confirm`, { method: 'POST' }),

  // --- Ronda 2: Traceability Admin (TRZ-02) ---
  getLotTraceability: (lotId: string) => fetchStaffApi<LotTraceability>(`/admin/traceability/lots/${lotId}`),
  searchLots: (query: string) =>
    fetchStaffApi<{ items: LotSearchResult[] }>(`/admin/traceability/lots?search=${encodeURIComponent(query)}`).then((r) => r.items),
};
