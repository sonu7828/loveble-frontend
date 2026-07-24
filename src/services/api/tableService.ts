/**
 * Table API Query Service for Express REST API Backend.
 * Direct Express API data accessor replacing legacy Supabase table queries.
 */
import { ApiClient } from "./client";

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
    if (this.action === "insert") {
      res = await ApiClient.post(`/${this.tableName}`, this.payload);
    } else if (this.action === "update" || this.action === "upsert") {
      res = await ApiClient.patch(`/${this.tableName}`, this.payload);
    } else if (this.action === "delete") {
      res = await ApiClient.delete(`/${this.tableName}`);
    } else {
      res = await ApiClient.get(`/${this.tableName}`);
    }

    const data = res.data ?? [];
    return {
      data,
      error: res.error ? (typeof res.error === "string" ? { message: res.error } : res.error) : null,
      count: Array.isArray(data) ? data.length : 1,
    };
  }

  public then(resolve: (res: { data: any; error: any; count: number }) => void, reject?: (reason: any) => void) {
    this.execute().then(resolve, reject);
  }
}

export function apiQuery(tableName: string): ApiTableQuery {
  return new ApiTableQuery(tableName);
}
