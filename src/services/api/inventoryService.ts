/**
 * Inventory & Product Lots Service for Express REST API Backend.
 */
import { ApiClient } from "./client";

export interface ProductLot {
  id: string;
  product_name: string;
  lot_number: string;
  expiration_date: string | null;
  quantity_initial: number;
  quantity_remaining: number;
  unit: string;
  category: string | null;
  low_stock_threshold: number;
  notes: string | null;
  is_active: boolean;
  received_at: string;
}

const MOCK_LOTS: ProductLot[] = [
  {
    id: "lot-001",
    product_name: "Botox Cosmetic 100U",
    lot_number: "C5981A",
    expiration_date: "2026-12-31",
    quantity_initial: 50,
    quantity_remaining: 32,
    unit: "vials",
    category: "Injectables",
    low_stock_threshold: 10,
    notes: "Main freezer A",
    is_active: true,
    received_at: new Date().toISOString(),
  },
];

export const inventoryService = {
  async getLots(): Promise<ProductLot[]> {
    const res = await ApiClient.get<ProductLot[]>("/inventory/lots");
    // Unwrap nested { data: [...] } if present
    let data = res.data;
    if (data && typeof data === "object" && !Array.isArray(data) && "data" in (data as any)) {
      data = (data as any).data;
    }
    const apiLots: ProductLot[] = Array.isArray(data) && data.length > 0 ? data : [...MOCK_LOTS];

    // Merge locally saved lots (survive page reloads when API isn't persisting)
    try {
      const localLots: ProductLot[] = JSON.parse(localStorage.getItem("rka_demo_inventory_lots") || "[]");
      if (localLots.length > 0) {
        const apiIds = new Set(apiLots.map((l) => l.id));
        for (const lot of localLots) {
          if (lot?.id && !apiIds.has(lot.id)) {
            apiLots.unshift(lot);
          }
        }
      }
    } catch {
      /* ignore */
    }

    return apiLots;
  },

  async adjustLot(lotId: string, newQuantity: number, reason: string, notes?: string): Promise<boolean> {
    const res = await ApiClient.post("/inventory/adjust", { lotId, newQuantity, reason, notes });
    return !res.error;
  },

  async deactivateLot(lotId: string): Promise<boolean> {
    const res = await ApiClient.patch(`/inventory/lots/${lotId}`, { is_active: false });
    return !res.error;
  },

  async receiveLot(lotData: Partial<ProductLot>): Promise<ProductLot> {
    const res = await ApiClient.post<ProductLot>("/inventory/receive", lotData);
    return res.data || { id: `lot-${Date.now()}`, is_active: true, received_at: new Date().toISOString(), ...lotData } as ProductLot;
  },

  async getMovements(lotId: string): Promise<any[]> {
    const res = await ApiClient.get<any[]>(`/inventory/movements/${lotId}`);
    return res.data || [];
  }
};
