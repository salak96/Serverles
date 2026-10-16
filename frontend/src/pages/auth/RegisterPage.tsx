import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, HttpError, NetworkError } from '@/lib/api';
import { AuthShell } from './LoginPage';
import { Mail, UserPlus, Eye, EyeOff } from 'lucide-react';
import { PolicyModal } from '@/components/ui';
import { termsOfServiceContent, privacyPolicyContent } from './policies';

const schema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter.').max(120),
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(8, 'Password minimal 8 karakter.'),
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Anda harus menyetujui syarat layanan.' }) }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.', path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { acceptTerms: false as unknown as true },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailInfo, setEmailInfo] = useState<{ configured: boolean; delivered: boolean; reason?: string } | null>(null);
  const [openModal, setOpenModal] = useState<'tos' | 'privacy' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onSubmit = async (data: FormData): Promise<void> => {
    setServerError(null);
    try {
      const res = await api<{ message: string; emailVerificationRequired: boolean; emailDelivery: { configured: boolean; delivered: boolean; reason?: string } }>('/auth/register', { method: 'POST', body: data });
      if (!res.emailVerificationRequired) {
        navigate('/auth/login', { replace: true, state: { message: 'Registrasi berhasil. Akun Anda sudah aktif, silakan login.' } });
        return;
      }
      setEmailInfo(res.emailDelivery);
    } catch (e) {
      // Network failure (no HTTP response): distinct from server errors.
      if (e instanceof NetworkError) {
        setServerError(e.message);
        return;
      }
      if (e instanceof HttpError) {
        setServerError(translateRegisterError(e));
        return;
      }
      // Anything else (e.g. unexpected runtime error in the client).
      setServerError('Terjadi kesalahan tak terduga. Coba lagi.');
    }
  };

  /**
   * Translate a backend register error into a user-friendly message.
   * Also surfaces field-level errors into react-hook-form when the
   * backend provided them (Zod flatten shape).
   */
  function translateRegisterError(err: HttpError): string {
    if (err.status === 409 || err.code === 'CONFLICT' || err.code === 'EMAIL_ALREADY_EXISTS') {
      return 'Email sudah terdaftar. Silakan login atau gunakan email lain.';
    }
    if (err.status === 429) {
      return 'Terlalu banyak percobaan registrasi. Tunggu beberapa menit lalu coba lagi.';
    }
    if (err.status >= 500) {
      return 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.';
    }
    if (err.code === 'VALIDATION_ERROR' && err.details && typeof err.details === 'object') {
      // Zod flatten output: { fieldErrors: { name?: string[], email?: string[], ... }, formErrors: string[] }
      const d = err.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
      const fieldErrors = d.fieldErrors ?? {};
      // Map each field error to the form.
      (['name', 'email', 'password', 'confirmPassword', 'acceptTerms'] as const).forEach((f) => {
        const msgs = fieldErrors[f];
        if (msgs && msgs.length > 0) {
          setError(f as keyof FormData, { type: 'server', message: msgs[0] });
        }
      });
      const formErrs = d.formErrors ?? [];
      if (formErrs.length > 0) return formErrs[0];
    }
    return err.message || 'Periksa kembali data registrasi Anda.';
  }

  if (emailInfo) {
    return (
      <AuthShell title="Periksa email Anda" subtitle="Kami telah mengirim tautan verifikasi.">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-accent/20 text-accent flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
          <p className="text-ink-muted text-sm">
            Jika email terlihat valid, tautan verifikasi akan dikirim. Tautan berlaku 24 jam.
          </p>
          {!emailInfo.delivered && (
            <div className="bg-warning/10 border border-warning/30 text-warning text-xs rounded-lg px-3 py-2 text-left">
              {emailInfo.configured
                ? 'Pengiriman email gagal. Periksa konfigurasi SMTP server atau hubungi administrator. Jangan menganggap email verifikasi sudah terkirim.'
                : 'Pengiriman email belum dikonfigurasi (SMTP). Dalam mode pengembangan, tautan verifikasi dicatat ke log server. Pada produksi, hubungi admin untuk mengaktifkan SMTP.'}
            </div>
          )}
          <button className="btn btn-secondary w-full" onClick={() => navigate('/auth/login')}>Kembali ke halaman masuk</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Daftar akun PawangTools" subtitle="Mulai kelola langganan dan lisensi Anda.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Nama lengkap</label>
          <input className="input" autoComplete="name" {...register('name')} />
          {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
          <p className="text-[11px] text-ink-muted mt-1">Minimal 8 karakter, mengandung huruf besar, kecil, dan angka.</p>
        </div>
        <div>
          <label className="label">Konfirmasi password</label>
          <div className="relative">
            <input
              className="input pr-10"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1"
              aria-label={showConfirm ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-danger mt-1">{errors.confirmPassword.message}</p>}
        </div>
        <div className="flex items-start gap-2 text-sm text-ink-muted">
          <input
            id="accept-terms"
            type="checkbox"
            className="mt-1 shrink-0"
            aria-required="true"
            aria-invalid={errors.acceptTerms ? 'true' : 'false'}
            aria-describedby={errors.acceptTerms ? 'accept-terms-error' : undefined}
            {...register('acceptTerms')}
          />
          <label htmlFor="accept-terms" className="leading-relaxed cursor-pointer select-none">
            Saya menyetujui{' '}
            <button
              type="button"
              onClick={() => setOpenModal('tos')}
              className="text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
            >
              Syarat &amp; Ketentuan Layanan
            </button>{' '}
            dan{' '}
            <button
              type="button"
              onClick={() => setOpenModal('privacy')}
              className="text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
            >
              Kebijakan Privasi
            </button>{' '}
            PawangTools.
          </label>
        </div>
        {errors.acceptTerms && (
          <p id="accept-terms-error" role="alert" className="text-xs text-danger">
            {errors.acceptTerms.message as string}
          </p>
        )}
        {serverError && (
          <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg px-3 py-2">{serverError}</div>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Membuat akun...' : <><UserPlus className="w-4 h-4" /> Daftar</>}
        </button>
        <p className="text-center text-sm text-ink-muted">
          Sudah punya akun? <Link to="/auth/login" className="text-accent hover:underline">Masuk</Link>
        </p>
      </form>

      <PolicyModal
        open={openModal === 'tos'}
        title="Syarat & Ketentuan Layanan"
        onClose={() => setOpenModal(null)}
      >
        {termsOfServiceContent}
      </PolicyModal>

      <PolicyModal
        open={openModal === 'privacy'}
        title="Kebijakan Privasi"
        onClose={() => setOpenModal(null)}
        primaryLabel="Tutup"
      >
        {privacyPolicyContent}
      </PolicyModal>
    </AuthShell>
  );
}
