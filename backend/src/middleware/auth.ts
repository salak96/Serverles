import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../modules/auth/auth.service';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { prisma } from '../config/prisma';

type SessionUser = NonNullable<Request['user']>;

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'USER' | 'ADMIN';
        email: string;
        emailVerified: boolean;
        status: string;
        sessionId: string;
      };
    }
  }
}

function readToken(req: Request): string | null {
  // Prefer HttpOnly cookie; fall back to Authorization header (bearer).
  const cookieToken = (req as { cookies?: Record<string, string> }).cookies?.['pt_access'];
  if (cookieToken) return cookieToken;
  const auth = req.headers.authorization;
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readToken(req);
    if (!token) throw new UnauthorizedError('Sesi tidak ditemukan. Silakan masuk.');
    const payload: AccessTokenPayload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, emailVerifiedAt: true, status: true },
    });
    if (!user) throw new UnauthorizedError('Pengguna tidak ditemukan.');
    if (user.status === 'SUSPENDED') throw new ForbiddenError('Akun Anda ditangguhkan. Hubungi admin.');
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      status: user.status,
      sessionId: payload.sid,
    };
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new UnauthorizedError('Autentikasi diperlukan.'));
  if (req.user.role !== 'ADMIN') return next(new ForbiddenError('Hanya admin yang dapat mengakses endpoint ini.'));
  next();
}

export function requireEmailVerified(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new UnauthorizedError('Autentikasi diperlukan.'));
  if (!req.user.emailVerified) {
    return next(new ForbiddenError('Email belum diverifikasi. Silakan verifikasi email terlebih dahulu.'));
  }
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    prisma.user
      .findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, email: true, emailVerifiedAt: true, status: true },
      })
      .then((user: { id: string; role: 'USER' | 'ADMIN'; email: string; emailVerifiedAt: Date | null; status: string } | null) => {
        if (!user || user.status === 'SUSPENDED') return next();
        const u: SessionUser = {
          id: user.id,
          role: user.role,
          email: user.email,
          emailVerified: Boolean(user.emailVerifiedAt),
          status: user.status,
          sessionId: payload.sid,
        };
        req.user = u;
        next();
      })
      .catch(() => next());
  } catch {
    next();
  }
}
