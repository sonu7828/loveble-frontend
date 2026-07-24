/**
 * Table API Query Service for Express REST API Backend.
 * Direct Express API data accessor replacing legacy Supabase table queries.
 */
import { ApiClient } from "./client";

export class ApiTableQuery {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  public select(columns = "*"): this {
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

  public order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    return this;
  }

  public limit(count: number): this {
    return this;
  }

  public async single(): Promise<{ data: any; error: any }> {
    const res = await ApiClient.get(`/${this.tableName}`);
    const first = Array.isArray(res.data) ? res.data[0] : res.data;
    return { data: first || null, error: res.error };
  }

  public async maybeSingle(): Promise<{ data: any; error: any }> {
    const res = await ApiClient.get(`/${this.tableName}`);
    const first = Array.isArray(res.data) ? res.data[0] : res.data;
    return { data: first || null, error: res.error };
  }

  public async insert(data: any): Promise<{ data: any; error: any }> {
    const res = await ApiClient.post(`/${this.tableName}`, data);
    return { data: res.data, error: res.error };
  }

  public async update(data: any): Promise<{ data: any; error: any }> {
    const res = await ApiClient.patch(`/${this.tableName}`, data);
    return { data: res.data, error: res.error };
  }

  public async delete(): Promise<{ data: any; error: any }> {
    const res = await ApiClient.delete(`/${this.tableName}`);
    return { data: res.data, error: res.error };
  }

  public then(resolve: (res: { data: any[]; error: any; count: number }) => void) {
    ApiClient.get<any[]>(`/${this.tableName}`).then((res) => {
      resolve({ data: res.data || [], error: res.error, count: (res.data || []).length });
    });
  }
}

export function apiQuery(tableName: string): ApiTableQuery {
  return new ApiTableQuery(tableName);
}
