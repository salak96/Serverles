import { Router, type Request, type Response } from 'express';
import argon2 from 'argon2';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireAuth } from '../../middleware/auth';
import { makeLimiter } from '../../middleware/rateLimit';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/errors';
import { recordAudit } from '../../services/audit.service';
import { assertRegistrationIpAvailable, claimRegistrationIp } from '../../services/registrationAbuse.service';
import { logger } from '../../config/logger';
import { verifyCaptcha } from '../../services/captcha.service';
import { emailService, verificationEmail, passwordResetEmail } from '../../services/email.service';
import {
  EMAIL_VERIFY_TTL_HOURS,
  PASSWORD_RESET_TTL_HOURS,
  hashPassword,
  hashToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllUserSessions,
  revokeRefreshToken,
  signAccessToken,
  validatePasswordPolicy,
  verifyPassword,
  generateOpaqueToken,
} from './auth.service';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schema';

const router = Router();

const authLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: 'Terlalu banyak percobaan. Coba lagi 15 menit.' });
const resendLimiter = makeLimiter({ windowMs: 5 * 60 * 1000, max: 3, message: 'Permintaan terlalu sering. Tunggu 5 menit.' });
const strictAuthLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, max: 8 });

function setAuthCookies(res: Response, accessToken: string, refreshToken: string, refreshExpiresAt: Date): void {
  const baseOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.IS_PRODUCTION,
    path: '/',
  };
  res.cookie('pt_access', accessToken, { ...baseOpts, maxAge: 15 * 60 * 1000 });
  res.cookie('pt_refresh', refreshToken, {
    ...baseOpts,
    expires: refreshExpiresAt,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie('pt_access', { path: '/' });
  res.clearCookie('pt_refresh', { path: '/' });
}

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') return xf.split(',')[0]?.trim() ?? req.ip ?? '';
  return req.ip ?? '';
}

function userAgent(req: Request): string {
  return (req.headers['user-agent'] ?? '').slice(0, 254);
}

function buildVerifyUrl(token: string): string {
  return `${env.APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
}

function buildResetUrl(token: string): string {
  return `${env.FRONTEND_URL.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    await verifyCaptcha(body.captchaToken, clientIp(req));
    validatePasswordPolicy(body.password);
    const registrationIp = clientIp(req);
    if (env.REGISTRATION_SINGLE_ACCOUNT_PER_IP) {
      await assertRegistrationIpAvailable(registrationIp);
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new ConflictError(
        'Email sudah terdaftar. Silakan login atau gunakan email lain.',
        { field: 'email' },
      );
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        status: env.EMAIL_VERIFICATION_REQUIRED ? 'PENDING_VERIFICATION' : 'ACTIVE',
        emailVerifiedAt: env.EMAIL_VERIFICATION_REQUIRED ? null : new Date(),
      },
    });

    if (env.REGISTRATION_SINGLE_ACCOUNT_PER_IP) {
      await claimRegistrationIp(registrationIp, user.id).catch(async (error: unknown) => {
        // Registration-IP claim is an abuse guard; DB uniqueness provides atomicity for concurrent requests.
        // If another request won the claim race, remove this newly-created unverified account before returning.
        await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          throw new ConflictError('Pendaftaran dari jaringan ini sudah pernah digunakan. Silakan masuk ke akun yang ada atau hubungi dukungan jika berbagi jaringan.');
        }
        logger.error({ error }, 'registration_ip_claim_failed');
        throw error;
      });
    }

    let sent: { delivered: boolean; reason?: string } = {
      delivered: false,
      reason: 'email_verification_disabled',
    };

    if (env.EMAIL_VERIFICATION_REQUIRED) {
      const token = generateOpaqueToken();
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000),
        },
      });

      const mail = verificationEmail({ name: user.name, verifyUrl: buildVerifyUrl(token) });
      mail.to = user.email;
      sent = await emailService.send(mail);
    }

    await recordAudit({
      actorUserId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      result: 'SUCCESS',
      ip: clientIp(req),
      userAgent: userAgent(req),
      metadata: {
        consent: {
          termsOfService: true,
          privacyPolicy: true,
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        message: env.EMAIL_VERIFICATION_REQUIRED
          ? 'Akun berhasil dibuat. Periksa email Anda untuk verifikasi.'
          : 'Akun berhasil dibuat dan langsung aktif.',
        emailVerificationRequired: env.EMAIL_VERIFICATION_REQUIRED,
        emailDelivery: {
          configured: env.EMAIL_VERIFICATION_REQUIRED && emailService.isConfigured(),
          delivered: env.EMAIL_VERIFICATION_REQUIRED && sent.delivered,
          reason: env.EMAIL_VERIFICATION_REQUIRED ? (sent.reason ?? null) : 'email_verification_disabled',
        },
      },
    });
  })
);

// ---------------------------------------------------------------
// POST /api/v1/auth/verify-email
// ---------------------------------------------------------------
router.post(
  '/verify-email',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token } = verifyEmailSchema.parse(req.body);
    const tokenHash = hashToken(token);
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ValidationError('Token verifikasi tidak valid atau kedaluwarsa.');
    }
    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      }),
    ]);
    await recordAudit({
      actorUserId: record.userId,
      action: 'auth.verify_email',
      entityType: 'User',
      entityId: record.userId,
      result: 'SUCCESS',
    });
    res.json({ success: true, data: { message: 'Email berhasil diverifikasi. Silakan masuk.' } });
  })
);

// ---------------------------------------------------------------
// POST /api/v1/auth/resend-verification
// ---------------------------------------------------------------
router.post(
  '/resend-verification',
  resendLimiter,
  asyncHandler(async (req, res) => {
    const { email } = resendVerificationSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Respond identically whether or not the user exists, to avoid email enumeration.
    if (user && !user.emailVerifiedAt) {
      // Invalidate prior tokens
      await prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      const token = generateOpaqueToken();
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000),
        },
      });
      const mail = verificationEmail({ name: user.name, verifyUrl: buildVerifyUrl(token) });
      mail.to = user.email;
      await emailService.send(mail);
    }
    res.json({
      success: true,
      data: {
        message: 'Jika email terdaftar dan belum diverifikasi, tautan baru telah dikirim.',
        emailDelivery: {
          configured: emailService.isConfigured(),
        },
      },
    });
  })
);

// ---------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------
router.post(
  '/login',
  strictAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    await verifyCaptcha(body.captchaToken, clientIp(req));
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    // Always run argon2 verify even if user not found, to avoid timing attacks.
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlzYWx0ZHVtbXkA$ZHVtbXloYXNoZHVtbXloYXNoZHVtbXk';
    const ok = user
      ? await verifyPassword(user.passwordHash, body.password)
      : await argon2.verify(dummyHash, body.password).catch(() => false);

    if (!user || !ok) {
      await recordAudit({
        actorUserId: user?.id ?? null,
        action: 'auth.login',
        entityType: 'User',
        entityId: user?.id ?? null,
        result: 'FAILURE',
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      throw new UnauthorizedError('Email atau password salah.');
    }
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedError('Akun Anda ditangguhkan. Hubungi admin.');
    }

    const sessionId = generateOpaqueToken().slice(0, 16);
    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      sid: sessionId,
    });
    const refresh = await issueRefreshToken(user.id, { ip: clientIp(req), userAgent: userAgent(req) });
    setAuthCookies(res, accessToken, refresh.token, refresh.expiresAt);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await recordAudit({
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      result: 'SUCCESS',
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    res.json({
      success: true,
      data: {
        accessToken,
        accessTokenExpiresIn: 15 * 60,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: Boolean(user.emailVerifiedAt),
          status: user.status,
        },
      },
    });
  })
);

// ---------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------
router.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const cookieToken: string | undefined = (req as { cookies?: Record<string, string> }).cookies?.['pt_refresh'];
    const bodyToken: string | undefined = (req.body as { refreshToken?: string })?.refreshToken;
    const token = cookieToken || bodyToken;
    if (!token) throw new UnauthorizedError('Refresh token tidak ditemukan.');

    const rotated = await rotateRefreshToken(token, { ip: clientIp(req), userAgent: userAgent(req) });
    const user = await prisma.user.findUnique({
      where: { id: rotated.userId },
      select: { id: true, email: true, role: true, status: true },
    });
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedError('Sesi tidak valid.');
    }
    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      sid: generateOpaqueToken().slice(0, 16),
    });
    setAuthCookies(res, accessToken, rotated.token, rotated.expiresAt);
    res.json({ success: true, data: { accessToken, accessTokenExpiresIn: 15 * 60 } });
  })
);

// ---------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const cookieToken: string | undefined = (req as { cookies?: Record<string, string> }).cookies?.['pt_refresh'];
    if (cookieToken) await revokeRefreshToken(cookieToken);
    clearAuthCookies(res);
    res.json({ success: true, data: { message: 'Anda telah keluar.' } });
  })
);

// ---------------------------------------------------------------
// POST /api/v1/auth/logout-all
// ---------------------------------------------------------------
router.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeAllUserSessions(req.user!.id);
    clearAuthCookies(res);
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'auth.logout_all',
      entityType: 'User',
      entityId: req.user!.id,
      result: 'SUCCESS',
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    res.json({ success: true, data: { message: 'Semua sesi telah dicabut.' } });
  })
);

// ---------------------------------------------------------------
// POST /api/v1/auth/forgot-password
// ---------------------------------------------------------------
router.post(
  '/forgot-password',
  resendLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      const token = generateOpaqueToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000),
        },
      });
      const mail = passwordResetEmail({ name: user.name, resetUrl: buildResetUrl(token) });
      mail.to = user.email;
      await emailService.send(mail);
    }
    // Always respond identically.
    res.json({
      success: true,
      data: {
        message: 'Jika email terdaftar, tautan reset telah dikirim.',
        emailDelivery: { configured: emailService.isConfigured() },
      },
    });
  })
);

// ---------------------------------------------------------------
// POST /api/v1/auth/reset-password
// ---------------------------------------------------------------
router.post(
  '/reset-password',
  strictAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    validatePasswordPolicy(body.password);
    const tokenHash = hashToken(body.token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ValidationError('Token reset tidak valid atau kedaluwarsa.');
    }
    const passwordHash = await hashPassword(body.password);
    await prisma.$transaction([
      prisma.passwordResetToken.update({ where: { tokenHash }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await recordAudit({
      actorUserId: record.userId,
      action: 'auth.reset_password',
      entityType: 'User',
      entityId: record.userId,
      result: 'SUCCESS',
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    res.json({ success: true, data: { message: 'Kata sandi berhasil diubah. Silakan masuk.' } });
  })
);

// ---------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!u) throw new NotFoundError('Pengguna tidak ditemukan.');
    res.json({
      success: true,
      data: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        emailVerified: Boolean(u.emailVerifiedAt),
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      },
    });
  })
);

export default router;
