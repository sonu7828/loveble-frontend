/**
 * Base API Client for Node.js + Express REST API Backend.
 * Handles HTTP requests, headers, authorization tokens, and API error formatting.
 * Includes: in-flight deduplication, short-lived GET cache, and 429 exponential-backoff retry.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:5000/api";

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

const inFlightRequests = new Map<string, Promise<ApiResponse<any>>>();
const responseCache = new Map<string, { data: ApiResponse<any>; timestamp: number }>();
const CACHE_TTL_MS = 10_000; // 10 s — avoids duplicate requests after mutations

/** Sleep helper for backoff delays */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class ApiClient {
  private static getToken(): string | null {
    return localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
  }

  public static clearCache(endpointPattern?: string) {
    if (!endpointPattern) {
      responseCache.clear();
      return;
    }
    const cleanPattern = endpointPattern.replace(/^\//, "").split("/")[0];
    for (const key of responseCache.keys()) {
      if (!cleanPattern || key.includes(cleanPattern)) {
        responseCache.delete(key);
      }
    }
  }

  /**
   * Core HTTP request with automatic 429 retry using exponential backoff.
   * Retries up to `maxRetries` times on 429 or network errors.
   */
  public static async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries = 4
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

        // 429 – rate limited: back off and retry
        if (response.status === 429 && attempt < maxRetries) {
          const retryAfterHeader = response.headers.get("retry-after");
          const waitMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : Math.min(600 * Math.pow(2, attempt), 10_000); // 600ms → 1.2s → 2.4s → 4.8s…
          await sleep(waitMs);
          continue;
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
        if (attempt < maxRetries) {
          await sleep(Math.min(600 * Math.pow(2, attempt), 10_000));
          continue;
        }
        return {
          data: null,
          error: err.message || "Network error. Please check backend connection.",
          status: 0,
        };
      }
    }

    return { data: null, error: "Max retries exceeded (rate limit)", status: 429 };
  }

  public static get<T = any>(endpoint: string, options: RequestInit = {}) {
    const cacheKey = endpoint;
    const now = Date.now();

    const cached = responseCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return Promise.resolve(cached.data as ApiResponse<T>);
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<ApiResponse<T>>;
    }

    const reqPromise = this.request<T>(endpoint, { ...options, method: "GET" })
      .then((res) => {
        inFlightRequests.delete(cacheKey);
        if (res.status === 200 || res.status === 304) {
          responseCache.set(cacheKey, { data: res, timestamp: Date.now() });
        }
        return res;
      })
      .catch((err) => {
        inFlightRequests.delete(cacheKey);
        throw err;
      });

    inFlightRequests.set(cacheKey, reqPromise);
    return reqPromise;
  }

  public static post<T = any>(endpoint: string, body?: any, options: RequestInit = {}) {
    this.clearCache(endpoint);
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public static put<T = any>(endpoint: string, body?: any, options: RequestInit = {}) {
    this.clearCache(endpoint);
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public static patch<T = any>(endpoint: string, body?: any, options: RequestInit = {}) {
    this.clearCache(endpoint);
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public static delete<T = any>(endpoint: string, options: RequestInit = {}) {
    this.clearCache(endpoint);
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}
