/**
 * Platform adapters. The web app stores the token in localStorage and sends
 * browser File objects; the mobile app uses AsyncStorage and {uri, name, type}
 * file parts. Everything above this layer is platform-independent.
 */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

/** A file to upload: a browser Blob/File (web) or a local uri (React Native). */
export interface FilePart {
  name: string;
  type?: string;
  blob?: Blob;
  uri?: string;
}

/** An error carrying the server's reason (FastAPI "detail") and HTTP status. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number = 0) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Token-bucket limiter: smooths request bursts so a runaway loop or rapid
 * double-submits can't flood the backend. Excess requests are delayed, not failed.
 */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(private readonly ratePerSec = 10, private readonly capacity = 20) {
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
      const waitMs = Math.ceil(((1 - this.tokens) / this.ratePerSec) * 1000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Skip the Authorization header (public endpoints). */
  anonymous?: boolean;
  timeoutMs?: number;
  /** Message used when the server gives no reason. */
  fallback?: string;
  /** Status codes that count as success (default: any 2xx). */
  ok?: number[];
  /** Don't end the session on a 401 (e.g. the sign-out call itself). */
  quiet401?: boolean;
  /** Housekeeping (heartbeat, marking read): not counted as work in progress. */
  background?: boolean;
}

/** HTTP client for the TaskNet gateway. One instance per app. */
export class ApiClient {
  private token: string | null | undefined;
  private readonly bucket = new TokenBucket();
  /** Called when the server rejects the token (401), with its reason, e.g. to end the session. */
  onUnauthorized: ((reason: string) => void) | null = null;
  /** Called when the number of saves/uploads in flight changes (so sign-out can wait for them). */
  onPendingChange: ((pending: number) => void) | null = null;
  private pending = 0;

  /** Saves and uploads still in flight. */
  get pendingWrites() { return this.pending; }

  /** Runs [work], counting it as in progress unless it's a read or housekeeping. */
  private async tracked<T>(method: string, opts: RequestOptions, work: () => Promise<T>): Promise<T> {
    if (method === 'GET' || opts.background) return work();
    this.onPendingChange?.(++this.pending);
    try {
      return await work();
    } finally {
      this.onPendingChange?.(--this.pending);
    }
  }

  constructor(readonly baseUrl: string, private readonly tokenStore: TokenStore) {}

  async getToken(): Promise<string | null> {
    if (this.token === undefined) this.token = await this.tokenStore.get();
    return this.token;
  }

  async saveToken(token: string): Promise<void> {
    this.token = token;
    await this.tokenStore.set(token);
  }

  async clearToken(): Promise<void> {
    this.token = null;
    await this.tokenStore.clear();
  }

  /** Absolute URL for a server-relative media path such as an avatar. */
  mediaUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    return /^https?:/.test(path) ? path : `${this.baseUrl}${path}`;
  }

  url(path: string, query?: Query): string {
    const qs = query
      ? Object.entries(query)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
  }

  get<T = any>(path: string, opts: RequestOptions = {}) { return this.request<T>('GET', path, opts); }
  post<T = any>(path: string, opts: RequestOptions = {}) { return this.request<T>('POST', path, opts); }
  put<T = any>(path: string, opts: RequestOptions = {}) { return this.request<T>('PUT', path, opts); }
  patch<T = any>(path: string, opts: RequestOptions = {}) { return this.request<T>('PATCH', path, opts); }
  delete<T = any>(path: string, opts: RequestOptions = {}) { return this.request<T>('DELETE', path, opts); }

  /** JSON request; resolves with the parsed body (null when empty). */
  request<T = any>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    return this.tracked(method, opts, () => this.requestNow<T>(method, path, opts));
  }

  private async requestNow<T>(method: string, path: string, opts: RequestOptions): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (!opts.anonymous) {
      const t = await this.getToken();
      if (t) headers.Authorization = `Bearer ${t}`;
    }
    const res = await this.send(this.url(path, opts.query), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }, opts.timeoutMs);
    return this.handle<T>(res, opts);
  }

  /** Multipart upload of one file under the "file" field. */
  upload<T = any>(path: string, file: FilePart, opts: RequestOptions & { field?: string; fields?: Record<string, string> } = {}): Promise<T> {
    return this.uploadMany<T>(path, [file], opts);
  }

  /** Multipart upload of several files under one field (e.g. a proposal's page photos, in order). */
  uploadMany<T = any>(path: string, files: FilePart[], opts: RequestOptions & { field?: string; fields?: Record<string, string> } = {}): Promise<T> {
    return this.tracked('POST', opts, () => this.uploadNow<T>(path, files, opts));
  }

  private async uploadNow<T>(path: string, files: FilePart[], opts: RequestOptions & { field?: string; fields?: Record<string, string> }): Promise<T> {
    const form = new FormData();
    for (const [k, v] of Object.entries(opts.fields ?? {})) form.append(k, v);
    for (const file of files) {
      if (file.blob) {
        form.append(opts.field ?? 'file', file.blob, file.name);
      } else {
        // React Native's FormData accepts {uri, name, type}.
        form.append(opts.field ?? 'file', { uri: file.uri, name: file.name, type: file.type ?? 'application/octet-stream' } as any);
      }
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    const t = await this.getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
    const res = await this.send(this.url(path, opts.query), { method: 'POST', headers, body: form }, opts.timeoutMs);
    return this.handle<T>(res, opts);
  }

  /** Raw bytes of an authenticated file (e.g. a certificate). */
  async blob(path: string, fallback = 'Could not open the file'): Promise<Blob> {
    const t = await this.getToken();
    const res = await this.send(this.url(path), { headers: t ? { Authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new ApiError(await this.reason(res, fallback), res.status);
    return res.blob();
  }

  private async send(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
    await this.bucket.acquire();
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl?.signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new ApiError('The server took too long to respond. Try again.');
      throw new ApiError('Cannot reach the server. Check your network.');
    } finally {
      clearTimeout(timer);
    }
  }

  private async handle<T>(res: Response, opts: RequestOptions): Promise<T> {
    const okay = opts.ok ? opts.ok.includes(res.status) : res.ok;
    if (!okay) {
      const reason = await this.reason(res, opts.fallback ?? 'Something went wrong');
      if (res.status === 401 && !opts.anonymous && !opts.quiet401) this.onUnauthorized?.(reason);
      throw new ApiError(reason, res.status);
    }
    const text = await res.text();
    if (!text) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /** The server's "detail" message, or [fallback]. */
  private async reason(res: Response, fallback: string): Promise<string> {
    try {
      const d = JSON.parse(await res.text())?.detail;
      if (typeof d === 'string' && d) return d;
      if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, '');
    } catch {
      /* not JSON */
    }
    return fallback;
  }
}
