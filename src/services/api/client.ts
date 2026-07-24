/**
 * Base API Client for Node.js + Express REST API Backend.
 * Handles HTTP requests, headers, authorization tokens, and API error formatting.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:5000/api";

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

export class ApiClient {
  private static getToken(): string | null {
    return localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
  }

  public static async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const contentType = response.headers.get("content-type");
      let data: any = null;
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        return {
          data: null,
          error: data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      return {
        data: data !== null ? data : ({} as T),
        error: null,
        status: response.status,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err.message || "Network error. Please check backend connection.",
        status: 0,
      };
    }
  }

  public static get<T = any>(endpoint: string, options: RequestInit = {}) {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  public static post<T = any>(endpoint: string, body?: any, options: RequestInit = {}) {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public static put<T = any>(endpoint: string, body?: any, options: RequestInit = {}) {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public static patch<T = any>(endpoint: string, body?: any, options: RequestInit = {}) {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public static delete<T = any>(endpoint: string, options: RequestInit = {}) {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}
