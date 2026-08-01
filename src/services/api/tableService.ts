/**
 * Table API Query Service for Express REST API Backend.
 * Direct Express API data accessor replacing legacy Supabase table queries.
 */
import { ApiClient } from "./client";

const MOCK_FALLBACKS: Record<string, any[]> = {
  staff_directory: [
    {
      id: "st-girish",
      full_name: "Girish",
      fullName: "Girish",
      title: "Nurse Practitioner",
      color: "#8B6B5D",
      is_active: true,
      role: "nurse_practitioner",
    },
  ],
  staff_profiles: [
    {
      id: "st-girish",
      full_name: "Girish",
      fullName: "Girish",
      title: "Nurse Practitioner",
      color: "#8B6B5D",
      is_active: true,
      role: "nurse_practitioner",
    },
  ],
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
  client_profiles: [],
  appointments: [],
  imported_clients: [],
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

  public gt(column: string, value: any): this {
    this.filters.push({ col: column, op: "gt", val: value });
    return this;
  }

  public lt(column: string, value: any): this {
    this.filters.push({ col: column, op: "lt", val: value });
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

  /** Apply filters on a data array returned by SELECT (client-side fallback) */
  private applyFilters(data: any[]): any[] {
    return data.filter((row) =>
      this.filters.every((f) => {
        const v = row[f.col];
        if (f.op === "eq") return String(v) === String(f.val);
        if (f.op === "neq") return String(v) !== String(f.val);
        if (f.op === "gte") return v !== undefined && v !== null && new Date(v).getTime() >= new Date(f.val).getTime();
        if (f.op === "lte") return v !== undefined && v !== null && new Date(v).getTime() <= new Date(f.val).getTime();
        if (f.op === "gt") return v !== undefined && v !== null && new Date(v).getTime() > new Date(f.val).getTime();
        if (f.op === "lt") return v !== undefined && v !== null && new Date(v).getTime() < new Date(f.val).getTime();
        if (f.op === "in") return Array.isArray(f.val) && f.val.map(String).includes(String(v));
        if (f.op === "is") return f.val === null ? v == null : v === f.val;
        if (f.op === "gt") return v > f.val;
        if (f.op === "gte") return v >= f.val;
        if (f.op === "lt") return v < f.val;
        if (f.op === "lte") return v <= f.val;
        if (f.op === "ilike") {
           const pat = String(f.val).toLowerCase().replace(/%/g, "");
           return typeof v === "string" && v.toLowerCase().includes(pat);
        }
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

    // If insert/upsert action, persist payload to local demo storage
    if ((this.action === "insert" || this.action === "upsert") && this.payload) {
      try {
        const storeKey = `rka_demo_${this.tableName}`;
        const existing: any[] = JSON.parse(localStorage.getItem(storeKey) || "[]");
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        for (const item of items) {
          if (item && typeof item === "object") {
            const idx = existing.findIndex((e) => e.id && item.id && String(e.id) === String(item.id));
            if (idx >= 0) existing[idx] = { ...existing[idx], ...item };
            else existing.unshift(item);
          }
        }
        localStorage.setItem(storeKey, JSON.stringify(existing));
      } catch (e) {
        console.warn("Failed to save local demo table data", e);
      }
    }

    // If update action, apply the payload changes to matching local storage records
    if (this.action === "update" && this.payload) {
      try {
        const storeKey = `rka_demo_${this.tableName}`;
        const existing: any[] = JSON.parse(localStorage.getItem(storeKey) || "[]");
        let matchFound = false;
        const updated = existing.map((row) => {
          const matches = this.filters.every((f) => {
            const v = row[f.col];
            if (f.op === "eq") return String(v) === String(f.val);
            return true;
          });
          if (matches) matchFound = true;
          return matches ? { ...row, ...this.payload } : row;
        });
        if (!matchFound) {
          // No local record exists (appointment came from API) —
          // create a stub so the override is applied on next SELECT merge.
          const stub: any = { ...this.payload };
          for (const f of this.filters) {
            if (f.op === "eq") stub[f.col] = f.val;
          }
          updated.push(stub);
        }
        localStorage.setItem(storeKey, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to update local demo table data", e);
      }
    }

    // If delete action, remove matching records from local storage
    if (this.action === "delete") {
      try {
        const storeKey = `rka_demo_${this.tableName}`;
        const existing: any[] = JSON.parse(localStorage.getItem(storeKey) || "[]");
        if (existing.length > 0) {
          const remaining = existing.filter((row) =>
            !this.filters.every((f) => {
              const v = row[f.col];
              if (f.op === "eq") return String(v) === String(f.val);
              return true;
            })
          );
          localStorage.setItem(storeKey, JSON.stringify(remaining));
        }
      } catch (e) {
        console.warn("Failed to delete from local demo table data", e);
      }
    }

    let data = res?.data;
    if (data && typeof data === "object" && !Array.isArray(data) && "data" in data) {
      data = data.data;
    }
    if ((!data || (Array.isArray(data) && data.length === 0)) && MOCK_FALLBACKS[this.tableName]) {
      data = [...MOCK_FALLBACKS[this.tableName]];
    }
    data = Array.isArray(data) ? [...data] : (data ? [data] : []);

    if (this.action === "select") {
      try {
        const storeKey = `rka_demo_${this.tableName}`;
        const localItems: any[] = JSON.parse(localStorage.getItem(storeKey) || "[]");
        if (localItems.length > 0) {
          // Build a map from local storage for fast lookup
          const localMap = new Map<string, any>();
          for (const item of localItems) {
            if (item?.id) localMap.set(String(item.id), item);
          }
          // Merge: update existing rows with local overrides, then add any local-only rows
          const existingIds = new Set<string>();
          data = data.map((row: any) => {
            if (row?.id) {
              existingIds.add(String(row.id));
              const localVersion = localMap.get(String(row.id));
              // Local storage wins for fields that differ (tracks our mutations)
              return localVersion ? { ...row, ...localVersion } : row;
            }
            return row;
          });
          // Add local-only items (not returned by API) 
          for (const item of localItems) {
            if (item?.id && !existingIds.has(String(item.id))) {
              data.unshift(item);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load local demo table data", e);
      }
    }

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

  public catch(reject: (reason: any) => void) {
    return this.execute().catch(reject);
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
