import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
}).strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.',
  path: ['confirmPassword'],
}).refine((d) => d.currentPassword !== d.newPassword, {
  message: 'Password baru harus berbeda dengan yang lama.',
  path: ['newPassword'],
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
