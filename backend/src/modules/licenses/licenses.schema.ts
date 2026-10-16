import { z } from 'zod';

export const createLicenseSchema = z.object({
  planId: z.string().min(1),
  durationDays: z.number().int().min(1).max(3650).optional(),
  name: z.string().max(120).optional(),
  userId: z.string().optional(), // admin can create for a specific user
});
export type CreateLicenseInput = z.infer<typeof createLicenseSchema>;

export const updateLicenseSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED', 'PENDING']).optional(),
  revokeReason: z.string().max(255).optional(),
  extendDays: z.number().int().min(1).max(3650).optional(),
  planId: z.string().optional(),
});
export type UpdateLicenseInput = z.infer<typeof updateLicenseSchema>;

export const activateDeviceSchema = z.object({
  deviceId: z.string().min(8, 'deviceId minimal 8 karakter.').max(255),
  deviceName: z.string().max(120).optional(),
  platform: z.string().max(60).optional(),
  appVersion: z.string().max(40).optional(),
});
export type ActivateDeviceInput = z.infer<typeof activateDeviceSchema>;

export const resetDeviceSchema = z.object({
  deviceId: z.string().min(1).optional(),
  reason: z.string().max(255).optional(),
});

export const validateLicenseSchema = z.object({
  licenseKey: z.string().min(8),
  deviceId: z.string().min(8).max(255),
  appVersion: z.string().max(40).optional(),
  platform: z.string().max(60).optional(),
  deviceName: z.string().max(120).optional(),
});
export type ValidateLicenseInput = z.infer<typeof validateLicenseSchema>;
