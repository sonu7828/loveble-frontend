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
  inventoryLots?: InventoryLot[];
}

export interface InventoryLot {
  id: string;
  productId?: string | null;
  productName: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  vendorId?: string | null;
  locationId: string;
  costPerUnitCents?: number | null;
  expiryDate?: string | null;
  receivedAt: string;
  product?: { id: string; name: string };
  location?: { id: string; name: string };
  vendor?: { id: string; name: string };
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
  movementType: 'received' | 'used' | 'adjusted' | 'transferred' | 'expired' | 'damaged';
  quantityChange: number;
  reason?: string;
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
  async getLots(locationId?: string): Promise<InventoryLot[]> {
    const qs = locationId ? `?locationId=${locationId}` : "";
    const res = await ApiClient.get<InventoryLot[]>(`/inventory/lots${qs}`);
    if (res.error) throw new Error(res.error);
    return Array.isArray(res.data) ? res.data : ((res.data as any)?.data || []);
  },

  /**
   * Get expiring inventory lots (within 30 days default).
   */
  async getExpiringLots(daysAhead = 30): Promise<InventoryLot[]> {
    const res = await ApiClient.get<InventoryLot[]>(`/inventory/lots/expiring?daysAhead=${daysAhead}`);
    if (res.error) throw new Error(res.error);
    return Array.isArray(res.data) ? res.data : ((res.data as any)?.data || []);
  },

  /**
   * Create new inventory lot / receive stock (Clinical / Staff).
   */
  async createLot(input: CreateLotInput): Promise<InventoryLot> {
    const res = await ApiClient.post<InventoryLot>("/inventory/lots", input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data || res.data;
  },

  /**
   * Create inventory movement / adjust stock.
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
