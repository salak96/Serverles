/**
 * Application error taxonomy. All thrown errors that should produce
 * a specific HTTP response should extend AppError. The error middleware
 * (see src/middleware/errorHandler.ts) is the single source of truth
 * for converting these into JSON responses — controllers never write
 * status codes directly.
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown; expose?: boolean } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = options.status ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = options.details;
    this.expose = options.expose ?? this.status < 500;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Permintaan tidak valid.', details?: unknown) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autentikasi diperlukan.') {
    super(message, { status: 401, code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Anda tidak memiliki akses untuk tindakan ini.') {
    super(message, { status: 403, code: 'FORBIDDEN' });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Data tidak ditemukan.') {
    super(message, { status: 404, code: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Data sudah ada atau terjadi konflik.', details?: unknown) {
    super(message, { status: 409, code: 'CONFLICT', details });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Terlalu banyak percobaan. Coba lagi nanti.') {
    super(message, { status: 429, code: 'RATE_LIMITED' });
  }
}

export class BusinessError extends AppError {
  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message, { status, code, details });
  }
}
