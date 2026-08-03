/**
 * Radiantilyk EMR — Central API Client
 * Phase 1A: Cookie-based authentication.
 *
 * - Uses `credentials: 'include'` on every request (browser sends HttpOnly cookies)
 * - No localStorage/sessionStorage token storage
 * - No Authorization: Bearer header injection
 * - Automatic 401 → silent refresh → retry (ONE attempt only)
 * - Auth endpoints (login, refresh, logout) are EXCLUDED from the refresh interceptor
 * - 429 exponential backoff retry
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:5000/api";

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

// ── In-flight deduplication & cache ──
const inFlightRequests = new Map<string, Promise<ApiResponse<any>>>();
const responseCache = new Map<string, { data: ApiResponse<any>; timestamp: number }>();
const CACHE_TTL_MS = 10_000; // 10s

/** Sleep helper for backoff delays */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Refresh interceptor state ──
// Prevents infinite 401→refresh loops and concurrent refresh attempts
let _isRefreshing = false;
let _refreshPromise: Promise<boolean> | null = null;

/** Endpoints excluded from the automatic 401 refresh interceptor */
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/refresh-token',
  '/auth/logout',
  '/auth/me',
  '/auth/mfa/login-verify',
  '/auth/mfa/setup',
  '/auth/mfa/verify',
];

function isAuthEndpoint(endpoint: string): boolean {
  const normalized = endpoint.replace(/^\/+/, '/');
  return AUTH_ENDPOINTS.some((ae) => normalized.endsWith(ae));
}

/**
 * Attempt a silent token refresh via POST /auth/refresh.
 * Returns true if refresh succeeded, false if it failed.
 */
async function silentRefresh(): Promise<boolean> {
  if (_isRefreshing && _refreshPromise) {
    return _refreshPromise;
  }

  _isRefreshing = true;
  _refreshPromise = (async () => {
    try {
      const normalizedBase = API_BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${normalizedBase}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      return resp.ok;
    } catch {
      return false;
    } finally {
      _isRefreshing = false;
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

export class ApiClient {
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
   * Core HTTP request.
   * - credentials: 'include' on every request
   * - Automatic 429 exponential backoff
   * - Automatic 401 → silent refresh → ONE retry (only for non-auth endpoints)
   */
  public static async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries = 4
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL.replace(/\/$/, "")}${normalizedEndpoint}`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include', // Send HttpOnly cookies
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
            : Math.min(600 * Math.pow(2, attempt), 10_000);
          await sleep(waitMs);
          continue;
        }

        // 401 – attempt ONE silent refresh, then retry original request
        if (response.status === 401 && !isAuthEndpoint(normalizedEndpoint)) {
          const refreshed = await silentRefresh();
          if (refreshed) {
            // Retry the original request exactly once
            const retryResponse = await fetch(url, {
              ...options,
              headers,
              credentials: 'include',
            });

            const retryContentType = retryResponse.headers.get("content-type");
            let retryData: any = null;
            if (retryContentType && retryContentType.includes("application/json")) {
              retryData = await retryResponse.json();
            }

            if (!retryResponse.ok) {
              return {
                data: null,
                error: retryData?.message || retryData?.error?.message || `HTTP ${retryResponse.status}`,
                status: retryResponse.status,
              };
            }

            return {
              data: retryData !== null ? retryData : ({} as T),
              error: null,
              status: retryResponse.status,
            };
          }

          // Refresh failed → redirect to login
          // Dispatch a custom event so the auth context can handle it
          window.dispatchEvent(new CustomEvent('rka_session_expired'));

          return {
            data: null,
            error: data?.message || data?.error?.message || 'Session expired',
            status: 401,
          };
        }

        if (!response.ok) {
          const errorMessage =
            data?.message ||
            data?.error?.message ||
            data?.error ||
            `HTTP ${response.status}: ${response.statusText}`;

          return {
            data: null,
            error: errorMessage,
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
