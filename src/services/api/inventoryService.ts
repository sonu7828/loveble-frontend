/**
 * Radiantilyk EMR — Inventory & Product Lots Service.
 * Connects directly to Node.js / Express live /inventory endpoints.
 * ZERO mock data, localStorage fallbacks, or invented endpoints.
 *
 * Supported backend routes (read from inventory.routes.ts):
 *   POST   /inventory/products
 *   GET    /inventory/products
 *   GET    /inventory/products/:id
 *   PATCH  /inventory/products/:id
 *   DELETE /inventory/products/:id
 *   POST   /inventory/lots               (admin only)
 *   GET    /inventory/lots               (all read roles)
 *   GET    /inventory/lots/expiring      (all read roles)
 *   GET    /inventory/lots/:id           (all read roles — returns movements[])
 *   POST   /inventory/usage              (admin, np, rn_injector)
 *   POST   /inventory/movements          (admin only)
 *
 * NOT SUPPORTED by backend:
 *   PATCH  /inventory/lots/:id           — does NOT exist
 *   DELETE /inventory/lots/:id           — does NOT exist
 *   GET    /inventory/movements          — does NOT exist as standalone
 *
 * Lot deactivation: NO backend endpoint. UI action is disabled.
 *
 * Accepted movementType values (from inventory.schema.ts):
 *   'received' | 'used' | 'adjusted' | 'wasted' | 'returned'
 */
import { ApiClient } from "./client";

// ---- Canonical Backend Response Types ----
// These match exact field names returned by the backend Prisma queries.

interface RawLot {
  id: string;
  productId: string | null;
  productName: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  vendorId: string | null;
  locationId: string;
  costPerUnitCents: number | null;
  expiryDate: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; name: string; minReorderLevel?: number };
  location?: { id: string; name: string };
  vendor?: { id: string; name: string };
  movements?: RawMovement[];
}

interface RawMovement {
  id: string;
  lotId: string;
  movementType: string;
  quantityChange: number;
  reason: string | null;
  patientId: string | null;
  encounterId: string | null;
  performedBy: string | null;
  createdAt: string;
}

// ---- Canonical Frontend Types ----
// Components consume ONLY these types. All mapping from backend names happens
// inside normalizeProductLot / normalizeInventoryMovement.

export interface ProductLot {
  id: string;
  productId: string | null;
  productName: string;
  lotNumber: string;
  /** Backend field: expiryDate (Date stored). Normalized to ISO date string or null. */
  expirationDate: string | null;
  /**
   * quantityRemaining: The current quantity on the lot (backend field: quantity).
   * The backend does not separately track quantityInitial.
   */
  quantityRemaining: number;
  unit: string;
  /**
   * lowStockThreshold: Derived from product.minReorderLevel when available.
   * Falls back to 10 (the backend schema default) if product is not included.
   */
  lowStockThreshold: number;
  isActive: boolean;
  receivedAt: string;
  locationId: string | null;
  vendorId: string | null;
  costPerUnitCents: number | null;
  createdAt: string;
  // Included relations (may be absent on list endpoint)
  product?: { id: string; name: string };
  location?: { id: string; name: string };
  vendor?: { id: string; name: string };
}

/** Exact union of movement types accepted by the backend (inventory.schema.ts line 53). */
export type InventoryMovementType = "received" | "used" | "adjusted" | "wasted" | "returned";

export interface InventoryMovement {
  id: string;
  lotId: string;
  /**
   * movementType: exactly one of the five values accepted by backend inventory.schema.ts.
   */
  movementType: InventoryMovementType;
  /**
   * quantityChange: signed integer.
   * Positive = stock added. Negative = stock removed.
   * Backend guards against sending quantity below 0.
   */
  quantityChange: number;
  reason: string | null;
  performedBy: string | null;
  createdAt: string;
}

// ---- Normalization Functions ----

function normalizeProductLot(raw: RawLot): ProductLot {
  // expiryDate may be a Date object serialized to ISO string or a date-only string
  let expirationDate: string | null = null;
  if (raw.expiryDate) {
    const d = raw.expiryDate.toString();
    // Accept ISO strings or YYYY-MM-DD strings
    expirationDate = d.length >= 10 ? d.substring(0, 10) : d;
  }

  const receivedAt =
    typeof raw.receivedAt === "string"
      ? raw.receivedAt.substring(0, 10)
      : new Date().toISOString().substring(0, 10);

  return {
    id: raw.id,
    productId: raw.productId ?? null,
    productName: raw.productName || raw.product?.name || "Unknown",
    lotNumber: raw.lotNumber,
    expirationDate,
    quantityRemaining: typeof raw.quantity === "number" ? raw.quantity : 0,
    unit: raw.unit || "units",
    // lowStockThreshold: backend lot has no lowStockThreshold field.
    // Read product.minReorderLevel when included in the response (getLotById includes it
    // if the backend select is extended), otherwise fall back to the backend default of 10.
    lowStockThreshold: raw.product?.minReorderLevel ?? 10,
    // Backend does not have isActive on lots; treat as active unless quantity is 0
    isActive: typeof raw.quantity === "number" ? raw.quantity >= 0 : true,
    receivedAt,
    locationId: raw.locationId ?? null,
    vendorId: raw.vendorId ?? null,
    costPerUnitCents: raw.costPerUnitCents ?? null,
    createdAt: raw.createdAt || raw.receivedAt || new Date().toISOString(),
    product: raw.product,
    location: raw.location,
    vendor: raw.vendor,
  };
}

function normalizeInventoryMovement(raw: RawMovement): InventoryMovement {
  return {
    id: raw.id,
    lotId: raw.lotId,
    movementType: raw.movementType as InventoryMovementType,
    quantityChange: typeof raw.quantityChange === "number" ? raw.quantityChange : 0,
    reason: raw.reason ?? null,
    performedBy: raw.performedBy ?? null,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

// ---- Input Types ----

export interface CreateProductInput {
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  unit: string;
  minReorderLevel?: number;
}

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
  expiryDate?: string; // YYYY-MM-DD
  receivedAt: string;  // YYYY-MM-DD
}

// MovementType is InventoryMovementType — use InventoryMovementType directly.
// Kept as alias for any downstream references.
export type MovementType = InventoryMovementType;

export interface CreateMovementInput {
  lotId: string;
  movementType: InventoryMovementType;
  quantityChange: number;
  reason?: string;
}

// ---- Service ----

export const inventoryService = {
  // ---- Products ----

  async getProducts(includeInactive = false): Promise<Product[]> {
    const res = await ApiClient.get<any>(`/inventory/products?includeInactive=${includeInactive}`);
    if (res.error) throw new Error(res.error);
    const list = Array.isArray(res.data) ? res.data : ((res.data as any)?.data ?? []);
    return list;
  },

  async getProductById(id: string): Promise<Product> {
    const res = await ApiClient.get<any>(`/inventory/products/${id}`);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data ?? res.data;
  },

  async createProduct(input: CreateProductInput): Promise<Product> {
    const res = await ApiClient.post<any>("/inventory/products", input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data ?? res.data;
  },

  async updateProduct(
    id: string,
    input: Partial<CreateProductInput> & { isActive?: boolean }
  ): Promise<Product> {
    const res = await ApiClient.patch<any>(`/inventory/products/${id}`, input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data ?? res.data;
  },

  async deleteProduct(id: string): Promise<{ message: string }> {
    const res = await ApiClient.delete(`/inventory/products/${id}`);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data ?? res.data;
  },

  // ---- Lots ----

  async getLots(locationId?: string): Promise<ProductLot[]> {
    const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
    const res = await ApiClient.get<any>(`/inventory/lots${qs}`);
    if (res.error) throw new Error(res.error);
    const rawList: RawLot[] = Array.isArray(res.data)
      ? res.data
      : ((res.data as any)?.data ?? []);
    return rawList.map(normalizeProductLot);
  },

  async getExpiringLots(daysAhead = 30): Promise<ProductLot[]> {
    const res = await ApiClient.get<any>(`/inventory/lots/expiring?daysAhead=${daysAhead}`);
    if (res.error) throw new Error(res.error);
    const rawList: RawLot[] = Array.isArray(res.data)
      ? res.data
      : ((res.data as any)?.data ?? []);
    return rawList.map(normalizeProductLot);
  },

  async createLot(input: CreateLotInput): Promise<ProductLot> {
    const res = await ApiClient.post<any>("/inventory/lots", input);
    if (res.error) throw new Error(res.error);
    const raw: RawLot = (res.data as any)?.data ?? res.data;
    return normalizeProductLot(raw);
  },

  // ---- Movements ----

  /**
   * Adjust lot stock quantity by posting a single 'adjusted' movement.
   *
   * Backend: POST /inventory/movements (admin only)
   * Schema:  { lotId: uuid, movementType: 'adjusted', quantityChange: signed-int, reason?: string }
   *
   * quantityChange = newQuantityRemaining - currentServerQuantity
   * If delta === 0, no request is made (no-op).
   * Backend rejects if resulting quantity < 0.
   *
   * CONCURRENCY NOTE: This computes delta from the locally loaded lot quantity.
   * The backend has no optimistic-lock / updatedAt conflict guard on lot quantity.
   * If another user updates the same lot between the load and this call, the delta
   * will be computed against a stale quantity. Callers should reload lots after adjustment.
   *
   * @param lot - The currently loaded ProductLot (used to compute delta)
   * @param newQuantityRemaining - Desired new quantity (must be >= 0)
   * @param reason - Optional reason string
   */
  async adjustLot(
    lot: ProductLot,
    newQuantityRemaining: number,
    reason = "Stock level adjustment"
  ): Promise<void> {
    if (!Number.isInteger(newQuantityRemaining) || newQuantityRemaining < 0) {
      throw new Error("Invalid quantity: must be a non-negative integer");
    }

    const delta = newQuantityRemaining - lot.quantityRemaining;

    if (delta === 0) {
      // No change needed — do not make a mutation request
      return;
    }

    const payload: CreateMovementInput = {
      lotId: lot.id,
      movementType: "adjusted",
      quantityChange: delta,
      reason,
    };

    const res = await ApiClient.post("/inventory/movements", payload);
    if (res.error) throw new Error(res.error);
  },

  /**
   * Lot deactivation is NOT supported by the backend.
   * There is no PATCH /inventory/lots/:id or DELETE /inventory/lots/:id endpoint.
   *
   * This method always throws an unsupported-operation error.
   * The UI must disable the Deactivate action.
   */
  async deactivateLot(_lotId: string): Promise<never> {
    throw new Error(
      "Lot deactivation is not supported: no backend endpoint exists for PATCH or DELETE /inventory/lots/:id. Contact your administrator."
    );
  },

  /**
   * Get movement ledger for a lot.
   *
   * Backend: GET /inventory/lots/:id (all read roles)
   * This endpoint includes up to 50 recent movements in the response (movements[]).
   *
   * If the API call fails, throws the real error rather than returning [] (which
   * would look like "no movements" and hide the failure).
   */
  async getMovements(lotId: string): Promise<InventoryMovement[]> {
    const res = await ApiClient.get<any>(`/inventory/lots/${lotId}`);
    if (res.error) throw new Error(res.error);
    const raw: RawLot = (res.data as any)?.data ?? res.data;
    const rawMovements: RawMovement[] = Array.isArray(raw?.movements) ? raw.movements : [];
    return rawMovements.map(normalizeInventoryMovement);
  },

  /**
   * Create a raw movement (admin only).
   * For stock adjustment from the UI, prefer adjustLot() instead.
   */
  async createMovement(input: CreateMovementInput): Promise<InventoryMovement> {
    const res = await ApiClient.post<any>("/inventory/movements", input);
    if (res.error) throw new Error(res.error);
    const raw: RawMovement = (res.data as any)?.data ?? res.data;
    return normalizeInventoryMovement(raw);
  },

  /**
   * Record clinical treatment lot consumption.
   * Requires: admin, nurse_practitioner, or rn_injector role.
   */
  async recordTreatmentUsage(input: {
    encounterId: string;
    lotId: string;
    unitsUsed: number;
    bodySite?: string;
  }): Promise<any> {
    const res = await ApiClient.post("/inventory/usage", input);
    if (res.error) throw new Error(res.error);
    return (res.data as any)?.data ?? res.data;
  },
};
