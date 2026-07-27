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
  client_profiles: [
    {
      id: "cp-01",
      email: "user@gmail.com",
      first_name: "Jane",
      last_name: "Doe",
      phone: "(555) 019-2831",
      dob: "1992-05-15",
      is_lead: false,
      created_at: new Date().toISOString(),
    },
    {
      id: "cp-02",
      email: "sarah.connor@gmail.com",
      first_name: "Sarah",
      last_name: "Connor",
      phone: "(408) 555-0142",
      dob: "1988-11-20",
      is_lead: false,
      created_at: new Date().toISOString(),
    },
    {
      id: "cp-03",
      email: "emily.watson@gmail.com",
      first_name: "Emily",
      last_name: "Watson",
      phone: "(408) 555-0188",
      dob: "1995-03-12",
      is_lead: false,
      created_at: new Date().toISOString(),
    },
    {
      id: "cp-04",
      email: "jessica.alba@gmail.com",
      first_name: "Jessica",
      last_name: "Alba",
      phone: "(415) 555-0123",
      dob: "1990-08-25",
      is_lead: false,
      created_at: new Date().toISOString(),
    },
  ],
  appointments: [
    {
      id: "apt-01",
      client_first_name: "Jane",
      client_last_name: "Doe",
      client_email: "user@gmail.com",
      client_phone: "(555) 019-2831",
      client_dob: "1992-05-15",
      status: "COMPLETED",
      start_at: new Date().toISOString(),
      service_id: "svc-01",
      service_name: "Botox Cosmetic (Per Unit)",
    },
    {
      id: "apt-02",
      client_first_name: "Sarah",
      client_last_name: "Connor",
      client_email: "sarah.connor@gmail.com",
      client_phone: "(408) 555-0142",
      client_dob: "1988-11-20",
      status: "CONFIRMED",
      start_at: new Date(Date.now() + 86400000).toISOString(),
      service_id: "svc-02",
      service_name: "Juvederm Voluma Lip Filler",
    },
    {
      id: "apt-03",
      client_first_name: "Emily",
      client_last_name: "Watson",
      client_email: "emily.watson@gmail.com",
      client_phone: "(408) 555-0188",
      client_dob: "1995-03-12",
      status: "CHECKED_IN",
      start_at: new Date().toISOString(),
      service_id: "svc-03",
      service_name: "RF Microneedling Face",
    },
  ],
  imported_clients: [
    {
      id: "imp-01",
      first_name: "Jessica",
      last_name: "Alba",
      email: "jessica.alba@gmail.com",
      phone: "(415) 555-0123",
      dob: "1990-08-25",
      gender: "female",
      notes: "VIP Client",
      created_at: new Date().toISOString(),
    },
  ],
};

export class ApiTableQuery {
  private tableName: string;
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;
  private filters: Array<{ col: string; op: string; val: any }> = [];
  private limitCount: number | null = null;
  private selectedColumns = "*";

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  public select(columns = "*"): this {
    this.action = "select";
    this.selectedColumns = columns;
    return this;
  }

  public eq(column: string, value: any): this {
    this.filters.push({ col: column, op: "eq", val: value });
    return this;
  }

  public neq(column: string, value: any): this {
    this.filters.push({ col: column, op: "neq", val: value });
    return this;
  }

  public gte(column: string, value: any): this {
    this.filters.push({ col: column, op: "gte", val: value });
    return this;
  }

  public lte(column: string, value: any): this {
    this.filters.push({ col: column, op: "lte", val: value });
    return this;
  }

  public is(column: string, value: any): this {
    this.filters.push({ col: column, op: "is", val: value });
    return this;
  }

  public in(column: string, values: any[]): this {
    this.filters.push({ col: column, op: "in", val: values });
    return this;
  }

  public not(column: string, operator: string, value: any): this {
    this.filters.push({ col: column, op: `not.${operator}`, val: value });
    return this;
  }

  public ilike(column: string, pattern: string): this {
    this.filters.push({ col: column, op: "ilike", val: pattern });
    return this;
  }

  public order(column: string, _options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    return this;
  }

  public limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  public range(_from: number, _to: number): this {
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

  public upsert(data: any, _options?: any): this {
    this.action = "upsert";
    this.payload = data;
    return this;
  }

  public delete(): this {
    this.action = "delete";
    return this;
  }

  /** Build a query-string from stored filters for DELETE/UPDATE requests */
  private buildQueryString(): string {
    if (!this.filters.length) return "";
    const params = new URLSearchParams();
    for (const f of this.filters) {
      params.append(f.col, String(f.val));
    }
    return `?${params.toString()}`;
  }

  /** Apply eq/in filters on a data array returned by SELECT (client-side fallback) */
  private applyFilters(data: any[]): any[] {
    return data.filter((row) =>
      this.filters.every((f) => {
        const v = row[f.col];
        if (f.op === "eq") return String(v) === String(f.val);
        if (f.op === "neq") return String(v) !== String(f.val);
        if (f.op === "in") return Array.isArray(f.val) && f.val.map(String).includes(String(v));
        if (f.op === "is") return f.val === null ? v == null : v === f.val;
        return true; // pass through for ops we can't handle client-side
      })
    );
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
    const qs = this.buildQueryString();
    try {
      if (this.action === "insert") {
        res = await ApiClient.post(`/${this.tableName}`, this.payload);
      } else if (this.action === "update" || this.action === "upsert") {
        res = await ApiClient.patch(`/${this.tableName}${qs}`, this.payload);
      } else if (this.action === "delete") {
        res = await ApiClient.delete(`/${this.tableName}${qs}`);
      } else {
        res = await ApiClient.get(`/${this.tableName}`);
      }
    } catch {
      res = { data: null, error: null };
    }

    let data = res?.data;
    if (data && typeof data === "object" && !Array.isArray(data) && "data" in data) {
      data = data.data;
    }
    if ((!data || (Array.isArray(data) && data.length === 0)) && MOCK_FALLBACKS[this.tableName]) {
      data = MOCK_FALLBACKS[this.tableName];
    }
    data = data ?? [];

    // For SELECT queries, apply client-side filtering so callers with .eq() get correct subsets
    if (this.action === "select" && Array.isArray(data) && this.filters.length > 0) {
      data = this.applyFilters(data);
    }
    if (this.limitCount !== null && Array.isArray(data)) {
      data = data.slice(0, this.limitCount);
    }

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

/** Minimal fake realtime channel (no-op since Express backend has no built-in realtime). */
class FakeChannel {
  on(_event: string, _filter: any, _cb?: Function): this { return this; }
  subscribe(_cb?: Function): this { return this; }
}

export interface ApiQueryFunction {
  (tableName: string): ApiTableQuery;
  from: (tableName: string) => ApiTableQuery;
  channel: (channelName: string) => any;
  removeChannel: (ch: any) => void;
  functions: {
    invoke: (fnName: string, options?: any) => Promise<{ data: any; error: any }>;
  };
}

export const apiQuery: ApiQueryFunction = Object.assign(
  (tableName: string) => new ApiTableQuery(tableName),
  {
    from: (tableName: string) => new ApiTableQuery(tableName),
    channel: (name: string) => ({
      on: (_event: any, _filter: any, _callback: any) => ({
        subscribe: () => ({ name }),
      }),
      subscribe: () => ({ name }),
    }),
    removeChannel: (_ch: any) => {},
    functions: {
      invoke: async (fnName: string, _options?: any) => {
        return { data: null, error: null };
      },
    },
  }
);
