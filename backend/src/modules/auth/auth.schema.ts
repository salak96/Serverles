import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(120),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.').max(191),
  password: z.string().min(8, 'Password minimal 8 karakter.').max(128),
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Anda harus menyetujui syarat layanan.' }) }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Password minimal 8 karakter.').max(128),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.',
  path: ['confirmPassword'],
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
