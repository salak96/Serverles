import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import multer from 'multer';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function notFoundHandler(): RequestHandler {
  return (req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Rute ${req.method} ${req.originalUrl} tidak ditemukan.` },
    } satisfies ErrorBody);
  };
}

export function errorHandler(): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const isSizeLimit = err.code === 'LIMIT_FILE_SIZE';
      res.status(isSizeLimit ? 413 : 400).json({
        success: false,
        error: {
          code: err.code,
          message: isSizeLimit
            ? 'Ukuran file terlalu besar. Gambar ikon maksimal 5 MB; file rilis maksimal 500 MB.'
            : 'Upload file gagal. Pastikan hanya satu file diunggah dan coba lagi.',
        },
      } satisfies ErrorBody);
      return;
    }

    // JSON body parse failure (express.json throws SyntaxError on bad JSON).
    // We must return 400, not 500, because this is a client-side input error.
    const isBodyParseError =
      err instanceof SyntaxError &&
      'body' in (err as object) &&
      (err as { type?: string }).type === 'entity.parse.failed';
    if (isBodyParseError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Body permintaan tidak dapat dibaca sebagai JSON yang valid.',
        },
      } satisfies ErrorBody);
      return;
    }

    // Zod validation: the request was syntactically valid JSON but failed
    // business rules. 422 (Unprocessable Content) is the semantically
    // correct status; we keep 400 for legacy callers by also accepting the
    // older code in clients (see api.ts handling).
    if (err instanceof ZodError) {
      const fieldErrors = err.flatten().fieldErrors as Record<string, string[] | undefined>;
      const friendlyFieldErrors: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(fieldErrors)) {
        if (v && v.length > 0) friendlyFieldErrors[k] = v;
      }
      const formErrors = err.flatten().formErrors;
      const firstFieldError = Object.values(friendlyFieldErrors).flat()[0];
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstFieldError ?? formErrors[0] ?? 'Periksa kembali data yang Anda masukkan.',
          details: {
            fieldErrors: friendlyFieldErrors,
            formErrors,
          },
        },
      } satisfies ErrorBody);
      return;
    }

    // Known application errors
    if (err instanceof AppError) {
      // Normalize details: if details is { field: 'x' }, expose it as
      // { fieldErrors: { x: <message> }, ... } so the frontend can route
      // the error to the matching form field. We keep the original
      // `details` under `details.raw` for clients that depend on it.
      let details: unknown = err.details;
      if (err.details && typeof err.details === 'object' && 'field' in (err.details as Record<string, unknown>)) {
        const d = err.details as { field: string; raw?: unknown };
        details = {
          fieldErrors: { [d.field]: err.message },
          formErrors: [],
          raw: d.raw ?? err.details,
        };
      }
      res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message, details },
      } satisfies ErrorBody);
      return;
    }

    // Prisma known errors
    if (err instanceof PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        // Translate known unique targets to friendlier messages.
        const target = (err.meta?.target as string[] | undefined) ?? [];
        const isEmail = target.some((t) => t === 'email' || t === 'users_email_key');
        if (isEmail) {
          res.status(409).json({
            success: false,
            error: {
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'Email sudah terdaftar. Silakan login atau gunakan email lain.',
            },
          } satisfies ErrorBody);
          return;
        }
        const tStr = target.length > 0 ? target.join(', ') : 'field';
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Data dengan ${tStr} tersebut sudah ada.`,
          },
        } satisfies ErrorBody);
        return;
      }
      if (err.code === 'P2025') {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Data yang diminta tidak ditemukan.' },
        } satisfies ErrorBody);
        return;
      }
      if (err.code === 'P2022') {
        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_SCHEMA_OUTDATED',
            message: 'Struktur database belum diperbarui. Jalankan migrasi database lalu mulai ulang backend.',
          },
        } satisfies ErrorBody);
        return;
      }
      if (err.code === 'P2000') {
        res.status(422).json({
          success: false,
          error: { code: 'VALUE_TOO_LONG', message: 'Salah satu nilai terlalu panjang. Periksa kembali isian form.' },
        } satisfies ErrorBody);
        return;
      }
    }

    // Unknown error — log full, return generic
    const requestId = (req as { id?: string }).id;
    logger.error({ err, requestId, path: req.originalUrl, method: req.method }, 'unhandled_error');

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan pada server. Silakan coba lagi nanti.',
      },
    } satisfies ErrorBody);
  };
}

// Wrap async route handlers so thrown errors flow to the error handler.
export function asyncHandler<T extends RequestHandler>(handler: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
