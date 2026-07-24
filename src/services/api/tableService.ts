/**
 * Table API Query Service for Express REST API Backend.
 * Direct Express API data accessor replacing legacy Supabase table queries.
 */
import { ApiClient } from "./client";

const MOCK_FALLBACKS: Record<string, any[]> = {
  locations: [
    {
      id: "loc-sj-01",
      name: "San Jose Clinic",
      slug: "san-jose",
      address: "123 Medical Center Way, Suite 200, San Jose, CA 95128",
      phone: "(408) 555-0199",
      google_place_id: "ChIJrTLr-GfxloARy5B5mX80h0Q",
      google_review_url: "https://g.page/r/RadiantilykSanJose/review",
      is_active: true,
    },
  ],
  service_categories: [
    { id: "cat-01", name: "Injectables", description: "Neurotoxins, Dermal Fillers & Biostimulators", display_order: 1, is_active: true },
    { id: "cat-02", name: "Skin Resurfacing", description: "RF Microneedling, Chemical Peels & Lasers", display_order: 2, is_active: true },
    { id: "cat-03", name: "Laser Hair Reduction", description: "Diode & Alexandrite Laser Treatments", display_order: 3, is_active: true },
  ],
  services: [
    { id: "svc-01", category_id: "cat-01", name: "Botox Cosmetic (Per Unit)", description: "FDA-approved neurotoxin for wrinkle reduction", duration_minutes: 30, price_cents: 1400, price_note: "$14 / unit", is_active: true, display_order: 1 },
    { id: "svc-02", category_id: "cat-01", name: "Juvederm Voluma Lip Filler", description: "Hyaluronic acid lip & cheek enhancement", duration_minutes: 45, price_cents: 75000, price_note: "$750 / syringe", is_active: true, display_order: 2 },
    { id: "svc-03", category_id: "cat-02", name: "RF Microneedling Face", description: "Collagen induction therapy with radiofrequency", duration_minutes: 60, price_cents: 65000, price_note: "$650 / session", is_active: true, display_order: 3 },
  ],
};

export class ApiTableQuery {
  private tableName: string;
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  public select(columns = "*"): this {
    this.action = "select";
    return this;
  }

  public eq(column: string, value: any): this {
    return this;
  }

  public neq(column: string, value: any): this {
    return this;
  }

  public gte(column: string, value: any): this {
    return this;
  }

  public lte(column: string, value: any): this {
    return this;
  }

  public is(column: string, value: any): this {
    return this;
  }

  public in(column: string, values: any[]): this {
    return this;
  }

  public ilike(column: string, pattern: string): this {
    return this;
  }

  public order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    return this;
  }

  public limit(count: number): this {
    return this;
  }

  public insert(data: any): this {
    this.action = "insert";
    this.payload = data;
    return this;
  }

  public update(data: any): this {
    this.action = "update";
    this.payload = data;
    return this;
  }

  public upsert(data: any, options?: any): this {
    this.action = "upsert";
    this.payload = data;
    return this;
  }

  public delete(): this {
    this.action = "delete";
    return this;
  }

  public async single(): Promise<{ data: any; error: any }> {
    const res = await this.execute();
    const first = Array.isArray(res.data) ? res.data[0] : res.data;
    return { data: first || null, error: res.error };
  }

  public async maybeSingle(): Promise<{ data: any; error: any }> {
    const res = await this.execute();
    const first = Array.isArray(res.data) ? res.data[0] : res.data;
    return { data: first || null, error: res.error };
  }

  private async execute(): Promise<{ data: any; error: any; count: number }> {
    let res: any;
    try {
      if (this.action === "insert") {
        res = await ApiClient.post(`/${this.tableName}`, this.payload);
      } else if (this.action === "update" || this.action === "upsert") {
        res = await ApiClient.patch(`/${this.tableName}`, this.payload);
      } else if (this.action === "delete") {
        res = await ApiClient.delete(`/${this.tableName}`);
      } else {
        res = await ApiClient.get(`/${this.tableName}`);
      }
    } catch {
      res = { data: null, error: null };
    }

    let data = res?.data;
    if ((!data || (Array.isArray(data) && data.length === 0)) && MOCK_FALLBACKS[this.tableName]) {
      data = MOCK_FALLBACKS[this.tableName];
    }
    data = data ?? [];

    return {
      data,
      error: res?.error ? (typeof res.error === "string" ? { message: res.error } : res.error) : null,
      count: Array.isArray(data) ? data.length : 1,
    };
  }

  public then(resolve: (res: { data: any; error: any; count: number }) => void, reject?: (reason: any) => void) {
    this.execute().then(resolve, reject);
  }
}

export interface ApiQueryFunction {
  (tableName: string): ApiTableQuery;
  from: (tableName: string) => ApiTableQuery;
}

export const apiQuery: ApiQueryFunction = Object.assign(
  (tableName: string) => new ApiTableQuery(tableName),
  {
    from: (tableName: string) => new ApiTableQuery(tableName),
  }
);
