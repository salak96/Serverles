import { prisma } from '../config/prisma';
import { ConflictError } from '../utils/errors';
import { hmacClientIp } from '../utils/crypto';

const IP_CLAIM_PREFIX = 'registration-ip:';

/** Refuse a second account registration from an IP already claimed by an account. */
export async function assertRegistrationIpAvailable(ip: string): Promise<void> {
  const normalizedIp = ip.trim();
  if (!normalizedIp || normalizedIp === 'unknown') return;
  const claimKey = `${IP_CLAIM_PREFIX}${hmacClientIp(normalizedIp)}`;
  const existingClaim = await prisma.appSetting.findUnique({ where: { key: claimKey }, select: { id: true } });
  if (existingClaim) {
    throw new ConflictError('Pendaftaran dari jaringan ini sudah pernah digunakan. Silakan masuk ke akun yang ada atau hubungi dukungan jika berbagi jaringan.', { field: 'email' });
  }
  // Respect registration history written before the HMAC claim guard existed.
  const previousRegistration = await prisma.auditLog.findFirst({
    where: { action: 'auth.register', ip: normalizedIp },
    select: { id: true },
  });
  if (previousRegistration) {
    throw new ConflictError('Pendaftaran dari jaringan ini sudah pernah digunakan. Silakan masuk ke akun yang ada atau hubungi dukungan jika berbagi jaringan.', { field: 'email' });
  }
}

/** Persist an irreversible HMAC claim; called after the account is successfully created. */
export async function claimRegistrationIp(ip: string, userId: string): Promise<void> {
  const normalizedIp = ip.trim();
  if (!normalizedIp || normalizedIp === 'unknown') return;
  const key = `${IP_CLAIM_PREFIX}${hmacClientIp(normalizedIp)}`;
  await prisma.appSetting.create({
    data: {
      key,
      value: { userId, claimedAt: new Date().toISOString() },
      updatedBy: userId,
    },
  });
}
