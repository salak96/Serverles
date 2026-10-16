const BASE = ((import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

export interface ApiSuccess<T> { success: true; data: T }
export interface ApiError { success: false; error: { code: string; message: string; details?: unknown } }
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Network/transport failure (no HTTP response received). */
export class NetworkError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  skipJson?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(BASE + (path.startsWith('/') ? path : `/${path}`), window.location.origin);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.pathname + url.search;
}

/**
 * Default user-facing message when the server returns a non-2xx response
 * with a body we cannot parse as the standard envelope (e.g. a proxy 502
 * page, an HTML error from a misconfigured upstream, or a truly empty
 * body). We never want to surface the raw "Permintaan gagal (N)" string
 * to end users.
 */
function fallbackMessage(status: number): string {
  if (status === 0) return 'Tidak dapat menghubungi server. Periksa koneksi internet Anda.';
  if (status === 401) return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
  if (status === 403) return 'Anda tidak memiliki akses untuk tindakan ini.';
  if (status === 404) return 'Data tidak ditemukan.';
  if (status === 409) return 'Data sudah ada atau terjadi konflik.';
  if (status === 422) return 'Periksa kembali data yang Anda masukkan.';
  if (status === 429) return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.';
  if (status >= 500) return 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.';
  return 'Permintaan tidak dapat diproses. Coba lagi.';
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, skipJson, headers, ...rest } = options;
  const init: RequestInit = {
    method: rest.method ?? 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...rest,
  };
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), init);
  } catch (e) {
    // Network/transport failure: DNS, offline, CORS preflight, connection
    // refused, abort, etc. We surface a friendly NetworkError so callers
    // can distinguish "no internet" from "server returned an error".
    throw new NetworkError('Tidak dapat menghubungi server. Periksa koneksi internet Anda.', e);
  }

  if (skipJson) return undefined as T;

  const text = await res.text();
  let payload: ApiResponse<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as ApiResponse<T>;
    } catch {
      // Body is not JSON (proxy error page, empty body, HTML, etc.).
      payload = null;
    }
  }

  if (!res.ok || (payload && payload.success === false)) {
    if (payload && payload.success === false) {
      throw new HttpError(
        res.status,
        payload.error.code,
        payload.error.message || fallbackMessage(res.status),
        payload.error.details,
      );
    }
    // Non-2xx without a parseable envelope. Use a friendly fallback.
    throw new HttpError(res.status, 'HTTP_ERROR', fallbackMessage(res.status));
  }

  if (payload && payload.success === true) return payload.data as T;
  // 2xx with a non-JSON body — return as-is. Caller can decide what to do.
  return text as unknown as T;
}
