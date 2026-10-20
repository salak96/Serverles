import jwt, { type SignOptions } from 'jsonwebtoken';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { BusinessError, ConflictError, UnauthorizedError } from '../../utils/errors';

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_DAYS = 30;
export const EMAIL_VERIFY_TTL_HOURS = 24;
export const PASSWORD_RESET_TTL_HOURS = 1;

export interface AccessTokenPayload {
  sub: string;
  role: 'USER' | 'ADMIN';
  email: string;
  sid: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function validatePasswordPolicy(p: string): void {
  // Use BusinessError(422) instead of ValidationError(400) so that the
  // HTTP status reflects "request is well-formed but fails business
  // rules", consistent with the Zod 422 path. The error code stays
  // VALIDATION_ERROR for backward compatibility with existing clients.
  const fail = (msg: string): never => {
    throw new BusinessError(msg, 'VALIDATION_ERROR', 422, { field: 'password' });
  };
  if (p.length < 8) fail('Password minimal 8 karakter.');
  if (p.length > 128) fail('Password terlalu panjang.');
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasDigit = /\d/.test(p);
  if (!(hasUpper && hasLower && hasDigit)) {
    fail('Password harus mengandung huruf besar, huruf kecil, dan angka.');
  }
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const opts: SignOptions = { expiresIn: ACCESS_TOKEN_TTL, issuer: 'pawangtools', audience: 'pawangtools-web' };
  return jwt.sign(payload, env.TOKEN_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.TOKEN_SECRET, {
      issuer: 'pawangtools',
      audience: 'pawangtools-web',
    }) as AccessTokenPayload;
    return decoded;
  } catch {
    throw new UnauthorizedError('Token akses tidak valid atau kedaluwarsa.');
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

export async function issueRefreshToken(userId: string, opts?: { userAgent?: string; ip?: string }): Promise<{ token: string; expiresAt: Date }> {
  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      userAgent: opts?.userAgent?.slice(0, 254) ?? null,
      ip: opts?.ip?.slice(0, 63) ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function rotateRefreshToken(oldToken: string, opts?: { userAgent?: string; ip?: string }): Promise<{ token: string; expiresAt: Date; userId: string }> {
  const oldHash = hashToken(oldToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: oldHash } });
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new UnauthorizedError('Sesi tidak valid. Silakan login ulang.');
  }
  const newToken = generateOpaqueToken();
  const newHash = hashToken(newToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { tokenHash: oldHash },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: newHash,
        userAgent: opts?.userAgent?.slice(0, 254) ?? null,
        ip: opts?.ip?.slice(0, 63) ?? null,
        expiresAt,
      },
    }),
  ]);
  return { token: newToken, expiresAt, userId: existing.userId };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const h = hashToken(token);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: h, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function ensureEmailAvailable(email: string): Promise<void> {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new ConflictError('Email sudah terdaftar. Gunakan email lain atau masuk.');
}
