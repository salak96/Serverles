import { prisma } from '../config/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';

export type ResetPolicy = {
  maxResets: number;
  periodDays: number;
  cooldownDays: number;
  requireAdmin: boolean;
  requireEmailVerification: boolean;
};

export const DEFAULT_RESET_POLICY: ResetPolicy = {
  maxResets: 2,
  periodDays: 30,
  cooldownDays: 7,
  requireAdmin: false,
  requireEmailVerification: true,
};

export async function getPlanResetPolicy(planId: string): Promise<ResetPolicy> {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new NotFoundError('Paket tidak ditemukan.');
  const policy = (plan.resetPolicy as Partial<ResetPolicy> | null) ?? {};
  return {
    maxResets: policy.maxResets ?? DEFAULT_RESET_POLICY.maxResets,
    periodDays: policy.periodDays ?? DEFAULT_RESET_POLICY.periodDays,
    cooldownDays: policy.cooldownDays ?? DEFAULT_RESET_POLICY.cooldownDays,
    requireAdmin: policy.requireAdmin ?? DEFAULT_RESET_POLICY.requireAdmin,
    requireEmailVerification: policy.requireEmailVerification ?? DEFAULT_RESET_POLICY.requireEmailVerification,
  };
}

export interface ResetCheck {
  allowed: boolean;
  reason?: string;
  used: number;
  max: number;
  nextAvailableAt?: Date;
}

export async function checkResetQuota(licenseId: string): Promise<ResetCheck> {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    select: { planId: true, user: { select: { emailVerifiedAt: true } } },
  });
  if (!license) throw new NotFoundError('Lisensi tidak ditemukan.');
  const policy = await getPlanResetPolicy(license.planId);

  if (policy.requireEmailVerification && !license.user.emailVerifiedAt) {
    return { allowed: false, reason: 'EMAIL_NOT_VERIFIED', used: 0, max: policy.maxResets };
  }

  const since = new Date(Date.now() - policy.periodDays * 24 * 60 * 60 * 1000);
  const completed = await prisma.deviceReset.count({
    where: { licenseId, status: 'COMPLETED', completedAt: { gte: since } },
  });

  if (completed >= policy.maxResets) {
    return { allowed: false, reason: 'RESET_QUOTA_EXCEEDED', used: completed, max: policy.maxResets };
  }

  const lastReset = await prisma.deviceReset.findFirst({
    where: { licenseId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });
  if (lastReset?.completedAt) {
    const next = new Date(lastReset.completedAt.getTime() + policy.cooldownDays * 24 * 60 * 60 * 1000);
    if (next > new Date()) {
      return { allowed: false, reason: 'RESET_COOLDOWN_ACTIVE', used: completed, max: policy.maxResets, nextAvailableAt: next };
    }
  }
  return { allowed: true, used: completed, max: policy.maxResets };
}

export function isPolicyValid(p: unknown): p is ResetPolicy {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.maxResets === 'number' &&
    typeof o.periodDays === 'number' &&
    typeof o.cooldownDays === 'number' &&
    typeof o.requireAdmin === 'boolean' &&
    typeof o.requireEmailVerification === 'boolean'
  );
}

export function assertPolicy(p: unknown): ResetPolicy {
  if (!isPolicyValid(p)) throw new ValidationError('Kebijakan reset tidak valid.');
  return p;
}
