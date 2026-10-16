// @vitest-environment jsdom
// Smoke test: api.ts error handling for non-2xx responses that do NOT
// match the standard { success, error } envelope. This is the root
// cause of the "Permintaan gagal (500)" message the user reported.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpError, NetworkError } from '../src/lib/api';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(status: number, body: string, contentType = 'application/json'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = vi.fn(async () => {
    return new Response(body, { status, headers: { 'Content-Type': contentType } });
  }) as any;
}

function mockFetchRejects(reason: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = vi.fn(async () => {
    throw reason;
  }) as any;
}

describe('api() error envelope handling', () => {
  it('HTTP 500 with HTML body (proxy error) -> friendly message, not raw "Permintaan gagal (500)"', async () => {
    mockFetchOnce(500, '<html><body>502 Bad Gateway</body></html>', 'text/html');
    const { api } = await import('../src/lib/api');
    try {
      await api('/auth/register', { method: 'POST', body: {} });
      expect.fail('expected HttpError');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      const err = e as HttpError;
      expect(err.status).toBe(500);
      expect(err.message).not.toMatch(/Permintaan gagal \(500\)/);
      expect(err.message).toMatch(/server/i);
    }
  });

  it('HTTP 422 with envelope -> surfaces backend message AND field errors', async () => {
    mockFetchOnce(422, JSON.stringify({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Periksa kembali data registrasi Anda.',
        details: { fieldErrors: { email: 'Format email tidak valid.' }, formErrors: [] },
      },
    }));
    const { api } = await import('../src/lib/api');
    try {
      await api('/auth/register', { method: 'POST', body: {} });
      expect.fail('expected HttpError');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      const err = e as HttpError;
      expect(err.status).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.message).toBe('Periksa kembali data registrasi Anda.');
      expect((err.details as { fieldErrors: { email: string } }).fieldErrors.email).toBe('Format email tidak valid.');
    }
  });

  it('HTTP 409 with envelope -> CONFLICT code, message preserved', async () => {
    mockFetchOnce(409, JSON.stringify({
      success: false,
      error: { code: 'CONFLICT', message: 'Email sudah terdaftar. Silakan login atau gunakan email lain.', details: { field: 'email' } },
    }));
    const { api } = await import('../src/lib/api');
    try {
      await api('/auth/register', { method: 'POST', body: {} });
      expect.fail('expected HttpError');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      const err = e as HttpError;
      expect(err.status).toBe(409);
      expect(err.code).toBe('CONFLICT');
    }
  });

  it('fetch TypeError (network) -> NetworkError, not HttpError', async () => {
    mockFetchRejects(new TypeError('Failed to fetch'));
    const { api } = await import('../src/lib/api');
    try {
      await api('/auth/register', { method: 'POST', body: {} });
      expect.fail('expected NetworkError');
    } catch (e) {
      expect(e).toBeInstanceOf(NetworkError);
      const err = e as NetworkError;
      expect(err.message).toMatch(/Tidak dapat menghubungi server/);
    }
  });

  it('HTTP 400 with empty body -> friendly message, not raw "Permintaan gagal (400)"', async () => {
    mockFetchOnce(400, '', 'application/json');
    const { api } = await import('../src/lib/api');
    try {
      await api('/auth/register', { method: 'POST', body: {} });
      expect.fail('expected HttpError');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      const err = e as HttpError;
      expect(err.status).toBe(400);
      expect(err.message).not.toMatch(/Permintaan gagal \(400\)/);
    }
  });
});
