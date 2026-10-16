// Smoke test for the register error translator. We isolate the
// translation logic by re-implementing the small data-shaping functions
// used in RegisterPage so we can test the contract without React.

import { describe, it, expect } from 'vitest';

type FormField = 'name' | 'email' | 'password' | 'confirmPassword' | 'acceptTerms';
type ServerError = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

// Mirror of translateRegisterError from RegisterPage. Kept here in sync
// to test the contract without spinning up React.
function translateRegisterError(
  err: ServerError,
  setFieldError: (field: FormField, message: string) => void,
): string {
  if (err.status === 409 || err.code === 'CONFLICT' || err.code === 'EMAIL_ALREADY_EXISTS') {
    return 'Email sudah terdaftar. Silakan login atau gunakan email lain.';
  }
  if (err.status === 429) {
    return 'Terlalu banyak percobaan registrasi. Tunggu beberapa menit lalu coba lagi.';
  }
  if (err.status >= 500) {
    return 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.';
  }
  if (err.code === 'VALIDATION_ERROR' && err.details && typeof err.details === 'object') {
    const d = err.details as { fieldErrors?: Record<string, string | string[]>; formErrors?: string[] };
    const fieldErrors = d.fieldErrors ?? {};
    (['name', 'email', 'password', 'confirmPassword', 'acceptTerms'] as const).forEach((f) => {
      const v = fieldErrors[f];
      if (v) {
        const msg = Array.isArray(v) ? v[0] : v;
        if (msg) setFieldError(f, msg);
      }
    });
    const formErrs = d.formErrors ?? [];
    if (formErrs.length > 0) return formErrs[0];
  }
  return err.message || 'Periksa kembali data registrasi Anda.';
}

describe('translateRegisterError', () => {
  it('returns friendly message for 409', () => {
    expect(translateRegisterError({ status: 409, code: 'CONFLICT', message: 'x' }, () => {}))
      .toBe('Email sudah terdaftar. Silakan login atau gunakan email lain.');
  });
  it('returns friendly message for EMAIL_ALREADY_EXISTS code', () => {
    expect(translateRegisterError({ status: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'x' }, () => {}))
      .toBe('Email sudah terdaftar. Silakan login atau gunakan email lain.');
  });
  it('returns 429 message', () => {
    expect(translateRegisterError({ status: 429, code: 'RATE_LIMITED', message: 'x' }, () => {}))
      .toBe('Terlalu banyak percobaan registrasi. Tunggu beberapa menit lalu coba lagi.');
  });
  it('returns 5xx generic message', () => {
    expect(translateRegisterError({ status: 500, code: 'INTERNAL_ERROR', message: 'should not surface' }, () => {}))
      .toBe('Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.');
  });
  it('surfaces field errors into setFieldError', () => {
    const captured: string[][] = [];
    const setFieldError = (field: FormField, message: string): void => {
      captured.push([field, message]);
    };
    const err: ServerError = {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'fallback',
      details: { fieldErrors: { email: 'Format email tidak valid.', password: 'Password minimal 8 karakter.' }, formErrors: [] },
    };
    const result = translateRegisterError(err, setFieldError);
    expect(result).toBe('fallback');
    expect(captured).toContainEqual(['email', 'Format email tidak valid.']);
    expect(captured).toContainEqual(['password', 'Password minimal 8 karakter.']);
  });
  it('accepts array-shaped field errors from Zod', () => {
    const captured: string[][] = [];
    const setFieldError = (field: FormField, message: string): void => {
      captured.push([field, message]);
    };
    const err: ServerError = {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'fallback',
      details: { fieldErrors: { email: ['Format email tidak valid.'] }, formErrors: [] },
    };
    translateRegisterError(err, setFieldError);
    expect(captured).toContainEqual(['email', 'Format email tidak valid.']);
  });
  it('falls back to server message when no field errors', () => {
    expect(translateRegisterError({ status: 422, code: 'VALIDATION_ERROR', message: 'periksa lagi' }, () => {}))
      .toBe('periksa lagi');
  });
});
