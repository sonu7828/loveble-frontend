/**
 * Radiantilyk EMR — Inventory & Product Lots Service.
 * Connects directly to Node.js / Express live /inventory endpoints.
 * ZERO mock data or localStorage fallbacks.
 */
import { ApiClient } from "./client";

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  category?: string | null;
  unit: string;
  minReorderLevel: number;
  isActive: boolean;
  createdAt: string;
  inventoryLots?: ProductLot[];
}

export interface ProductLot {
  id: string;
  productId?: string | null;
  productName: string;
  product_name: string;
  lotNumber: string;
  lot_number: string;
  expirationDate?: string | null;
  expiration_date?: string | null;
  expiryDate?: string | null;
  quantityInitial: number;
  quantity_initial: number;
  quantityRemaining: number;
  quantity_remaining: number;
  quantity: number;
  unit: string;
  category?: string | null;
  lowStockThreshold: number;
  low_stock_threshold: number;
  notes?: string | null;
  isActive: boolean;
  is_active: boolean;
  receivedAt: string;
  received_at: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  locationId?: string;
  location_id?: string;
  vendorId?: string | null;
  costPerUnitCents?: number | null;
  product?: { id: string; name: string };
  location?: { id: string; name: string };
  vendor?: { id: string; name: string };
}

export type InventoryLot = ProductLot;

export interface InventoryMovement {
  id: string;
  lotId: string;
  lot_id?: string;
  movementType: string;
  movement_type?: string;
  quantityChange: number;
  quantity_change?: number;
  qtyDelta?: number;
  qty_delta?: number;
  reason?: string;
  notes?: string | null;
  createdAt: string;
  created_at: string;
  performedBy?: string | null;
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  unit: string;
  minReorderLevel?: number;
}

export interface CreateLotInput {
  productId?: string;
  productName: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  vendorId?: string;
  locationId: string;
  costPerUnitCents?: number;
  expiryDate?: string;
  receivedAt: string;
}

export interface InventoryMovementInput {
  lotId: string;
  movementType: 'received' | 'used' | 'adjusted' | 'transferred' | 'expired' | 'damaged' | 'wasted' | 'returned';
  quantityChange: number;
  reason?: string;
}

export function mapBackendLotToProductLot(raw: any): ProductLot {
  if (!raw || typeof raw !== "object") {
    return {
      id: "",
      productName: "",
      product_name: "",
      lotNumber: "",
      lot_number: "",
      quantityInitial: 0,
      quantity_initial: 0,
      quantityRemaining: 0,
      quantity_remaining: 0,
      quantity: 0,
      unit: "units",
      lowStockThreshold: 10,
      low_stock_threshold: 10,
      isActive: true,
      is_active: true,
      receivedAt: new Date().toISOString().split("T")[0],
      received_at: new Date().toISOString().split("T")[0],
    };
  }

  const productName = raw.productName || raw.product_name || raw.product?.name || "Unknown Product";
  const lotNumber = raw.lotNumber || raw.lot_number || "";
  const expiryDate = raw.expiryDate || raw.expirationDate || raw.expiration_date || raw.expiry_date || null;
  const qtyRemaining = typeof raw.quantityRemaining === "number"
    ? raw.quantityRemaining
    : typeof raw.quantity_remaining === "number"
    ? raw.quantity_remaining
    : typeof raw.quantity === "number"
    ? raw.quantity
    : 0;

  const qtyInitial = typeof raw.quantityInitial === "number"
    ? raw.quantityInitial
    : typeof raw.quantity_initial === "number"
    ? raw.quantity_initial
    : qtyRemaining;

  const lowStockThreshold = typeof raw.lowStockThreshold === "number"
    ? raw.lowStockThreshold
    : typeof raw.low_stock_threshold === "number"
    ? raw.low_stock_threshold
    : 10;

  const receivedAt = raw.receivedAt || raw.received_at || raw.createdAt || raw.created_at || new Date().toISOString().split("T")[0];

  return {
    ...raw,
    id: raw.id,
    productId: raw.productId || raw.product_id,
    productName,
    product_name: productName,
    lotNumber,
    lot_number: lotNumber,
    expirationDate: expiryDate,
    expiration_date: expiryDate,
    expiryDate: expiryDate,
    quantityInitial: qtyInitial,
    quantity_initial: qtyInitial,
    quantityRemaining: qtyRemaining,
    quantity_remaining: qtyRemaining,
    quantity: qtyRemaining,
    unit: raw.unit || "units",
    category: raw.category || raw.product?.category || null,
    lowStockThreshold,
    low_stock_threshold: lowStockThreshold,
    notes: raw.notes || null,
    isActive: raw.isActive !== false && raw.is_active !== false,
    is_active: raw.isActive !== false && raw.is_active !== false,
    receivedAt,
    received_at: receivedAt,
    createdAt: raw.createdAt || raw.created_at || receivedAt,
    created_at: raw.createdAt || raw.created_at || receivedAt,
    updatedAt: raw.updatedAt || raw.updated_at || receivedAt,
    updated_at: raw.updatedAt || raw.updated_at || receivedAt,
    locationId: raw.locationId || raw.location_id,
    vendorId: raw.vendorId || raw.vendor_id,
    costPerUnitCents: raw.costPerUnitCents || raw.cost_per_unit_cents,
    product: raw.product,
    location: raw.location,
    vendor: raw.vendor,
  };
}

export const inventoryService = {
  /**
   * Get list of products from live database.
   */
  async getProducts(includeInactive = false): Promise<Product[]> {
    const res = await ApiClient.get<Product[]>(`/inventory/products?includeInactive=${includeInactive}`);
    if (res.error) throw new Error(res.error);
    const products = Array.isArray(res.data) ? res.data : ((res.data as any)?.data || []);
    return products;
  },

  /**
   * Get product by ID with lot details.
   */
  async getProductById(id: string): Promise<Product> {
    const res = await ApiClient.get<Product>(`/inventory/products/${id}`);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },

  /**
   * Create a new product (Admin only).
   */
  async createProduct(input: CreateProductInput): Promise<Product> {
    const res = await ApiClient.post<Product>("/inventory/products", input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },

  /**
   * Update product (Admin only).
   */
  async updateProduct(id: string, input: Partial<CreateProductInput> & { isActive?: boolean }): Promise<Product> {
    const res = await ApiClient.patch<Product>(`/inventory/products/${id}`, input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },

  /**
   * Soft-delete product (Admin only).
   */
  async deleteProduct(id: string): Promise<any> {
    const res = await ApiClient.delete(`/inventory/products/${id}`);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  /**
   * Get all inventory lots from live database.
   */
  async getLots(locationId?: string): Promise<ProductLot[]> {
    const qs = locationId ? `?locationId=${locationId}` : "";
    const res = await ApiClient.get<any[]>(`/inventory/lots${qs}`);
    if (res.error) throw new Error(res.error);
    const rawList = Array.isArray(res.data) ? res.data : ((res.data as any)?.data || []);
    return rawList.map(mapBackendLotToProductLot);
  },

  /**
   * Get expiring inventory lots (within 30 days default).
   */
  async getExpiringLots(daysAhead = 30): Promise<ProductLot[]> {
    const res = await ApiClient.get<any[]>(`/inventory/lots/expiring?daysAhead=${daysAhead}`);
    if (res.error) throw new Error(res.error);
    const rawList = Array.isArray(res.data) ? res.data : ((res.data as any)?.data || []);
    return rawList.map(mapBackendLotToProductLot);
  },

  /**
   * Create new inventory lot / receive stock (Clinical / Staff).
   */
  async createLot(input: CreateLotInput): Promise<ProductLot> {
    const res = await ApiClient.post<any>("/inventory/lots", input);
    if (res.error) throw new Error(res.error);
    const raw = (res.data as any)?.data || res.data;
    return mapBackendLotToProductLot(raw);
  },

  /**
   * Adjust lot quantity remaining.
   */
  async adjustLot(lotId: string, newQuantityRemaining: number, reason = "Stock level adjustment"): Promise<boolean> {
    try {
      const lotRes = await ApiClient.get<any>(`/inventory/lots/${lotId}`);
      if (lotRes.error) return false;
      const lot = lotRes.data?.data || lotRes.data;
      const currentQty = typeof lot?.quantity === "number" ? lot.quantity : (lot?.quantity_remaining ?? 0);
      const delta = newQuantityRemaining - currentQty;

      if (delta === 0) return true;

      const res = await ApiClient.post("/inventory/movements", {
        lotId,
        movementType: "adjusted",
        quantityChange: delta,
        reason,
      });

      if (res.error) return false;
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Deactivate an inventory lot.
   */
  async deactivateLot(lotId: string): Promise<boolean> {
    try {
      const res = await ApiClient.patch(`/inventory/lots/${lotId}`, { isActive: false });
      if (!res.error) return true;

      const delRes = await ApiClient.delete(`/inventory/lots/${lotId}`);
      if (!delRes.error) return true;

      // Fallback: record wasted movement zeroing stock
      const lotRes = await ApiClient.get<any>(`/inventory/lots/${lotId}`);
      if (lotRes.data) {
        const lot = lotRes.data?.data || lotRes.data;
        const currentQty = typeof lot?.quantity === "number" ? lot.quantity : 0;
        if (currentQty > 0) {
          const movRes = await ApiClient.post("/inventory/movements", {
            lotId,
            movementType: "wasted",
            quantityChange: -currentQty,
            reason: "Deactivated lot",
          });
          return !movRes.error;
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Get movement ledger for a lot.
   */
  async getMovements(lotId: string): Promise<InventoryMovement[]> {
    try {
      const res = await ApiClient.get<any>(`/inventory/lots/${lotId}`);
      if (res.error) return [];
      const lot = res.data?.data || res.data;
      const rawMovements = lot?.movements || [];
      return rawMovements.map((m: any) => {
        const qtyChange = typeof m.quantityChange === "number" ? m.quantityChange : (m.qty_delta ?? m.quantity_change ?? 0);
        const reason = m.reason || m.movementType || m.movement_type || "Stock adjustment";
        const createdAt = m.createdAt || m.created_at || new Date().toISOString();
        return {
          id: m.id,
          lotId: m.lotId || lotId,
          lot_id: m.lotId || lotId,
          movementType: m.movementType || m.movement_type || "adjusted",
          movement_type: m.movementType || m.movement_type || "adjusted",
          quantityChange: qtyChange,
          quantity_change: qtyChange,
          qtyDelta: qtyChange,
          qty_delta: qtyChange,
          reason,
          notes: m.notes || null,
          createdAt,
          created_at: createdAt,
          performedBy: m.performedBy || null,
        };
      });
    } catch {
      return [];
    }
  },

  /**
   * Create inventory movement.
   */
  async createMovement(input: InventoryMovementInput): Promise<any> {
    const res = await ApiClient.post("/inventory/movements", input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },

  /**
   * Record clinical treatment lot consumption.
   */
  async recordTreatmentUsage(input: { encounterId: string; lotId: string; unitsUsed: number; bodySite?: string }): Promise<any> {
    const res = await ApiClient.post("/inventory/usage", input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },
};
