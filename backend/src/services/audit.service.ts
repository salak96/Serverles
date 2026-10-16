import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

interface AuditInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

const FORBIDDEN_KEYS = ['password', 'token', 'accessToken', 'refreshToken', 'apiKey', 'key', 'secret', 'privateKey', 'cookie', 'authorization'];

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 2000) return value.slice(0, 2000) + '...[truncated]';
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.includes(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitize(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        result: input.result,
        metadata: (input.metadata ? (sanitize(input.metadata) as object) : undefined) as never,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (e) {
    logger.error({ err: e, action: input.action }, 'audit_log_failed');
  }
}
