/** Where the session token is kept (localStorage on web, SecureStore on mobile). */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ApiConfig {
  /** e.g. http://localhost:8000 (the gateway) */
  baseUrl: string;
  tokenStore: TokenStore;
  /** Called when an authenticated request comes back 401 (expired/revoked token). */
  onUnauthorized?: () => void;
}

/** An HTTP error, with the backend's `detail` as the message when it sent one. */
export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Token bucket: smooths bursts so a runaway loop or rapid double-submits can't
 * flood the backend. Excess requests are delayed, not failed.
 */
class TokenBucket {
  private tokens: number;
  private last = Date.now();
  private ratePerSec: number;
  private capacity: number;
  constructor(ratePerSec = 10, capacity = 20) {
    this.ratePerSec = ratePerSec;
    this.capacity = capacity;
    this.tokens = capacity;
  }

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.ratePerSec);
      this.last = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await new Promise((r) => setTimeout(r, Math.ceil(((1 - this.tokens) / this.ratePerSec) * 1000)));
    }
  }
}

let config: ApiConfig | null = null;
let cachedToken: string | null | undefined;
let unauthorizedHandler: (() => void) | null = null;
const bucket = new TokenBucket();

/** Set by the session layer: ends the session when the server rejects the token. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function configureApi(c: ApiConfig) {
  config = c;
  cachedToken = undefined;
}

function cfg(): ApiConfig {
  if (!config) throw new Error('configureApi() must be called before using the API');
  return config;
}

export const apiBaseUrl = () => cfg().baseUrl;

export async function getToken(): Promise<string | null> {
  if (cachedToken === undefined) cachedToken = await cfg().tokenStore.get();
  return cachedToken;
}

export async function saveToken(token: string) {
  cachedToken = token;
  await cfg().tokenStore.set(token);
}

export async function clearToken() {
  cachedToken = null;
  await cfg().tokenStore.clear();
}

/** Absolute URL for a server path such as "/uploads/x.pdf". */
export function resolveUrl(path: string | null | undefined): string {
  if (!path) return '';
  return /^https?:\/\//i.test(path) ? path : `${cfg().baseUrl}${path}`;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  query?: Query;
  /** JSON body */
  body?: unknown;
  /** multipart body (takes precedence over `body`) */
  form?: FormData;
  /** skip the Authorization header (public endpoints) */
  anonymous?: boolean;
  /** message when the server gives no `detail` */
  fallback?: string;
  timeoutMs?: number;
  /** return the raw Response (files) */
  raw?: boolean;
}

function buildUrl(path: string, query?: Query) {
  const qs = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${cfg().baseUrl}${path}${qs ? `?${qs}` : ''}`;
}

function detailOf(body: unknown): string | null {
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === 'string' && d) return d;
    // FastAPI validation errors: [{loc, msg, ...}]
    if (Array.isArray(d) && d[0] && typeof d[0].msg === 'string') return d[0].msg;
  }
  return null;
}

export async function request<T = unknown>(
  method: string, path: string, opts: RequestOptions = {},
): Promise<T> {
  await bucket.acquire();
  const headers: Record<string, string> = {};
  if (!opts.anonymous) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method, headers, body, signal: controller.signal });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your network.');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = undefined;
    }
    if (res.status === 401 && !opts.anonymous && headers.Authorization) {
      unauthorizedHandler?.();
      cfg().onUnauthorized?.();
    }
    throw new ApiError(res.status, detailOf(parsed) ?? opts.fallback ?? `Request failed (${res.status})`, parsed);
  }
  if (opts.raw) return res as unknown as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
  upload: <T>(path: string, form: FormData, opts?: RequestOptions) => request<T>('POST', path, { ...opts, form }),
};
