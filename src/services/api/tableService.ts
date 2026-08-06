/**
 * Table API Query Service for Express REST API Backend.
 * Direct Express API data accessor replacing legacy Supabase table queries.
 * Live Backend API Integration — Zero localStorage/sessionStorage/mock data usage.
 */
import { ApiClient } from "./client";

function normalizeRow(tableName: string, row: any): any {
  if (!row || typeof row !== "object") return row;
  
  const lowerTable = tableName.toLowerCase();
  
  if (lowerTable === "client_profiles" || lowerTable === "patient_profiles" || lowerTable === "patients") {
    return {
      ...row,
      id: row.id,
      first_name: row.firstName || row.first_name || "",
      last_name: row.lastName || row.last_name || "",
      firstName: row.firstName || row.first_name || "",
      lastName: row.lastName || row.last_name || "",
      email: row.email || "",
      phone: row.phone || "",
      dob: row.dateOfBirth ? new Date(row.dateOfBirth).toISOString().split("T")[0] : (row.dob || null),
      date_of_birth: row.dateOfBirth ? new Date(row.dateOfBirth).toISOString().split("T")[0] : (row.dob || null),
      created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at || new Date().toISOString()),
      account_status: row.isActive === false ? "disabled" : (row.account_status || "active"),
      is_active: row.isActive !== false,
    };
  }

  if (lowerTable === "appointments" || lowerTable === "appointment") {
    const patient = row.patient || {};
    const staff = row.staff || {};
    const location = row.location || {};
    const service = row.appointmentServices?.[0]?.service || row.service || {};

    return {
      ...row,
      id: row.id,
      patient_id: row.patientId || row.patient_id,
      patientId: row.patientId || row.patient_id,
      staff_id: row.staffId || row.staff_id,
      staffId: row.staffId || row.staff_id,
      location_id: row.locationId || row.location_id,
      locationId: row.locationId || row.location_id,
      start_at: row.startAt ? new Date(row.startAt).toISOString() : (row.start_at || new Date().toISOString()),
      end_at: row.endAt ? new Date(row.endAt).toISOString() : (row.end_at || new Date().toISOString()),
      startAt: row.startAt ? new Date(row.startAt).toISOString() : (row.start_at || new Date().toISOString()),
      endAt: row.endAt ? new Date(row.endAt).toISOString() : (row.end_at || new Date().toISOString()),
      status: (row.status || "PENDING").toLowerCase(),
      client_first_name: patient.firstName || row.client_first_name || "",
      client_last_name: patient.lastName || row.client_last_name || "",
      client_email: patient.email || row.client_email || "",
      client_phone: patient.phone || row.client_phone || "",
      staff_name: staff.fullName || row.staff_name || "",
      location_name: location.name || row.location_name || "",
      service_name: service.name || row.service_name || "Aesthetic Treatment",
      service_id: service.id || row.service_id || "",
      notes: row.notes || "",
    };
  }

  if (lowerTable === "service_categories" || lowerTable === "servicecategory") {
    return {
      ...row,
      id: row.id,
      name: row.name,
      slug: row.slug || (row.name ? row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ""),
      description: row.description || "",
      display_order: row.displayOrder !== undefined ? row.displayOrder : (row.display_order ?? 0),
      displayOrder: row.displayOrder !== undefined ? row.displayOrder : (row.display_order ?? 0),
      is_active: row.isActive !== false,
      isActive: row.isActive !== false,
    };
  }

  if (lowerTable === "services" || lowerTable === "service") {
    return {
      ...row,
      id: row.id,
      category_id: row.categoryId || row.category_id,
      categoryId: row.categoryId || row.category_id,
      name: row.name,
      slug: row.slug,
      description: row.description || "",
      duration_minutes: row.durationMinutes !== undefined ? row.durationMinutes : (row.duration_minutes ?? 30),
      durationMinutes: row.durationMinutes !== undefined ? row.durationMinutes : (row.duration_minutes ?? 30),
      price_cents: row.priceCents !== undefined ? row.priceCents : (row.price_cents ?? 0),
      priceCents: row.priceCents !== undefined ? row.priceCents : (row.price_cents ?? 0),
      price_note: row.priceNote || row.price_note || "",
      priceNote: row.priceNote || row.price_note || "",
      promo_group: row.promoGroup || row.promo_group || null,
      promoGroup: row.promoGroup || row.promo_group || null,
      is_active: row.isActive !== false,
      isActive: row.isActive !== false,
      display_order: row.displayOrder !== undefined ? row.displayOrder : (row.display_order ?? 0),
      displayOrder: row.displayOrder !== undefined ? row.displayOrder : (row.display_order ?? 0),
    };
  }

  return row;
}

export class ApiTableQuery {
  private tableName: string;
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;
  private filters: Array<{ col: string; op: string; val: any }> = [];
  private limitCount: number | null = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  public select(_columns = "*"): this {
    this.action = "select";
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

  public upsert(data: any, _opts?: any): this {
    this.action = "upsert";
    this.payload = data;
    return this;
  }

  public delete(): this {
    this.action = "delete";
    return this;
  }

  public eq(col: string, val: any): this {
    this.filters.push({ col, op: "eq", val });
    return this;
  }

  public neq(col: string, val: any): this {
    this.filters.push({ col, op: "neq", val });
    return this;
  }

  public gte(col: string, val: any): this {
    this.filters.push({ col, op: "gte", val });
    return this;
  }

  public lte(col: string, val: any): this {
    this.filters.push({ col, op: "lte", val });
    return this;
  }

  public gt(col: string, val: any): this {
    this.filters.push({ col, op: "gt", val });
    return this;
  }

  public lt(col: string, val: any): this {
    this.filters.push({ col, op: "lt", val });
    return this;
  }

  public in(col: string, val: any[]): this {
    this.filters.push({ col, op: "in", val });
    return this;
  }

  public ilike(col: string, val: string): this {
    this.filters.push({ col, op: "ilike", val });
    return this;
  }

  public is(col: string, val: any): this {
    this.filters.push({ col, op: "is", val });
    return this;
  }

  public not(col: string, op: string, val: any): this {
    this.filters.push({ col, op: `not.${op}`, val });
    return this;
  }

  public order(_col: string, _opts?: { ascending?: boolean }): this {
    return this;
  }

  public limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  public range(_from: number, _to: number): this {
    return this;
  }

  private buildQueryString(): string {
    const parts: string[] = [];
    for (const f of this.filters) {
      if (f.op === "eq") parts.push(`${encodeURIComponent(f.col)}=${encodeURIComponent(f.val)}`);
    }
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  }

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
        if (f.op === "ilike") {
          const pat = String(f.val).toLowerCase().replace(/%/g, "");
          return typeof v === "string" && v.toLowerCase().includes(pat);
        }
        if (f.op.startsWith("not.")) {
          const subOp = f.op.replace("not.", "");
          if (subOp === "is") return f.val === null ? v != null : v !== f.val;
          if (subOp === "eq") return String(v) !== String(f.val);
          if (subOp === "in") return !Array.isArray(f.val) || !f.val.map(String).includes(String(v));
          if (subOp === "ilike") {
            const pat = String(f.val).toLowerCase().replace(/%/g, "");
            return typeof v !== "string" || !v.toLowerCase().includes(pat);
          }
          return true;
        }
        return true;
      })
    );
  }

  public async single(): Promise<{ data: any; error: any }> {
    const res = await this.execute();
    if (res.error) {
      return { data: null, error: res.error };
    }
    const first = Array.isArray(res.data) ? res.data[0] : res.data;
    return { data: first || null, error: null };
  }

  public async maybeSingle(): Promise<{ data: any; error: any }> {
    const res = await this.execute();
    if (res.error) {
      return { data: null, error: res.error };
    }
    const first = Array.isArray(res.data) ? res.data[0] : res.data;
    return { data: first || null, error: null };
  }

  private async execute(): Promise<{ data: any; error: any; count: number }> {
    let res: any;
    const qs = this.buildQueryString();
    const lowerTable = this.tableName.toLowerCase();

    try {
      if (this.action === "insert") {
        res = await ApiClient.post(`/${this.tableName}`, this.payload);
      } else if (this.action === "update" || this.action === "upsert") {
        res = await ApiClient.patch(`/${this.tableName}${qs}`, this.payload);
      } else if (this.action === "delete") {
        res = await ApiClient.delete(`/${this.tableName}${qs}`);
      } else if (lowerTable === "service_categories" || lowerTable === "servicecategory") {
        res = await ApiClient.get(`/services/public`);
        if (res.error) {
          res = await ApiClient.get(`/services/categories`);
        }
      } else if (lowerTable === "services" || lowerTable === "service") {
        res = await ApiClient.get(`/services/public`);
        if (res?.data && !res.error) {
          const catList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
          const flatSvcs: any[] = [];
          catList.forEach((cat: any) => {
            (cat.services || []).forEach((s: any) => {
              flatSvcs.push({
                ...s,
                category_id: s.categoryId || cat.id,
                categoryId: s.categoryId || cat.id,
                category: { id: cat.id, name: cat.name, slug: cat.slug || "", display_order: cat.displayOrder ?? 0 },
              });
            });
          });
          res = { data: flatSvcs, error: null, status: 200 };
        } else {
          res = await ApiClient.get(`/${this.tableName}${qs}`);
        }
      } else {
        res = await ApiClient.get(`/${this.tableName}${qs}`);
      }
    } catch (err: any) {
      res = { data: null, error: err?.message || "Network request failed", status: 500 };
    }

    if (res?.error) {
      const errObj = typeof res.error === "string" ? { message: res.error } : res.error;
      return {
        data: this.action === "select" ? [] : null,
        error: errObj,
        count: 0,
      };
    }

    let data = res?.data;
    if (data && typeof data === "object" && !Array.isArray(data) && "data" in data) {
      data = data.data;
    }

    if (Array.isArray(data)) {
      data = data.map((row) => normalizeRow(this.tableName, row));
    } else if (data && typeof data === "object") {
      data = normalizeRow(this.tableName, data);
    } else {
      data = [];
    }

    if (this.action === "select" && Array.isArray(data) && this.filters.length > 0) {
      data = this.applyFilters(data);
    }
    if (this.limitCount !== null && Array.isArray(data)) {
      data = data.slice(0, this.limitCount);
    }

    return {
      data,
      error: null,
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
      invoke: async (_fnName: string, _options?: any) => {
        return { data: null, error: null };
      },
    },
  }
);
