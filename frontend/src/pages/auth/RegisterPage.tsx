import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { api, HttpError, NetworkError } from '@/lib/api';
import { Check, Circle, Mail, UserPlus } from 'lucide-react';
import { PolicyModal } from '@/components/ui';
import { termsOfServiceContent, privacyPolicyContent } from './policies';
import { AuthFooter, AuthShell, FormAlert, FormError, FormInput, PasswordInput, PrimaryButton, StatusIcon } from './AuthComponents';

const schema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(120, 'Nama maksimal 120 karakter.'),
  email: z.string().trim().email('Format email tidak valid.').max(191, 'Email terlalu panjang.'),
  password: z.string().min(8, 'Password minimal 8 karakter.').max(128, 'Password maksimal 128 karakter.'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi.'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Anda harus menyetujui syarat layanan.' }) }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.', path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

function PasswordRequirements({ password }: { password: string }) {
  const rules = [
    { label: 'Minimal 8 karakter (wajib)', met: password.length >= 8 },
    { label: 'Huruf besar & kecil (disarankan)', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'Angka atau simbol (disarankan)', met: /[\d\W_]/.test(password) },
  ];
  return (
    <ul className="grid gap-1.5 text-xs" aria-label="Persyaratan password">
      {rules.map((r) => (
        <li key={r.label} className={clsx('flex items-center gap-2 transition-colors', r.met ? 'text-success' : 'text-ink-muted')}>
          {r.met ? <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> : <Circle className="w-3 h-3 shrink-0 mx-px" aria-hidden="true" />}
          <span>{r.label}</span>
          <span className="sr-only">{r.met ? 'terpenuhi' : 'belum terpenuhi'}</span>
        </li>
      ))}
    </ul>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, setError, control, formState: { errors, isSubmitting, touchedFields, isSubmitted } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { acceptTerms: false as unknown as true },
  });
  const [password = '', confirmPassword = ''] = useWatch({ control, name: ['password', 'confirmPassword'] });
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailInfo, setEmailInfo] = useState<{ configured: boolean; delivered: boolean; reason?: string } | null>(null);
  const [openModal, setOpenModal] = useState<'tos' | 'privacy' | null>(null);

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
      <AuthShell title="Periksa email Anda" subtitle="Satu langkah lagi untuk mengaktifkan akun Anda.">
        <div className="text-center space-y-5">
          <StatusIcon><Mail className="w-6 h-6" /></StatusIcon>
          <p className="text-ink-muted text-sm leading-relaxed">
            Jika alamat email valid, tautan verifikasi akan dikirim. Tautan berlaku selama 24 jam.
          </p>
          {!emailInfo.delivered && (
            <FormAlert variant="warning">
              {emailInfo.configured
                ? 'Pengiriman email gagal. Periksa konfigurasi SMTP server atau hubungi administrator. Jangan menganggap email verifikasi sudah terkirim.'
                : 'Pengiriman email belum dikonfigurasi (SMTP). Dalam mode pengembangan, tautan verifikasi dicatat ke log server. Pada produksi, hubungi admin untuk mengaktifkan SMTP.'}
            </FormAlert>
          )}
          <button type="button" className="btn btn-secondary w-full h-12 rounded-[10px]" onClick={() => navigate('/auth/login')}>Kembali ke Login</button>
        </div>
      </AuthShell>
    );
  }

  const confirmMatches = confirmPassword.length > 0 && confirmPassword === password;
  // Zod skips refine() while other fields are invalid, so surface the mismatch directly.
  const confirmError = errors.confirmPassword?.message
    ?? ((touchedFields.confirmPassword || isSubmitted) && confirmPassword.length > 0 && !confirmMatches ? 'Konfirmasi password tidak cocok.' : undefined);

  return (
    <AuthShell title="Buat Akun" subtitle="Daftar untuk mulai menggunakan layanan PawangTools.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormInput
          label="Nama lengkap"
          placeholder="Nama sesuai identitas Anda"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <FormInput
          label="Email"
          type="email"
          inputMode="email"
          placeholder="nama@email.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Password"
          placeholder="Minimal 8 karakter"
          autoComplete="new-password"
          error={errors.password?.message}
          hint={<PasswordRequirements password={password} />}
          {...register('password', { deps: confirmPassword ? ['confirmPassword'] : [] })}
        />
        <PasswordInput
          label="Konfirmasi password"
          placeholder="Ulangi password"
          autoComplete="new-password"
          error={confirmError}
          hint={confirmMatches && !confirmError
            ? <p className="flex items-center gap-1.5 text-xs text-success"><Check className="w-3.5 h-3.5" aria-hidden="true" /> Password cocok</p>
            : undefined}
          {...register('confirmPassword')}
        />

        <div>
          <div className="flex items-start gap-3">
            <input
              id="accept-terms"
              type="checkbox"
              className="mt-0.5 w-[18px] h-[18px] shrink-0 rounded border-line bg-bg-sidebar accent-[#FF8A00] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
              aria-required="true"
              aria-invalid={errors.acceptTerms ? 'true' : 'false'}
              aria-describedby={errors.acceptTerms ? 'accept-terms-error' : undefined}
              {...register('acceptTerms')}
            />
            <label htmlFor="accept-terms" className="text-sm leading-relaxed text-ink-muted cursor-pointer select-none">
              Saya menyetujui{' '}
              <button
                type="button"
                onClick={() => setOpenModal('tos')}
                className="font-medium text-accent hover:text-accent-hover hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                Syarat &amp; Ketentuan
              </button>{' '}
              serta{' '}
              <button
                type="button"
                onClick={() => setOpenModal('privacy')}
                className="font-medium text-accent hover:text-accent-hover hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                Kebijakan Privasi
              </button>{' '}
              PawangTools.
            </label>
          </div>
          {errors.acceptTerms && <FormError id="accept-terms-error">{errors.acceptTerms.message as string}</FormError>}
        </div>

        {serverError && <FormAlert>{serverError}</FormAlert>}
        <div className="pt-1">
          <PrimaryButton loading={isSubmitting} loadingText="Membuat akun...">
            <UserPlus className="w-[18px] h-[18px]" aria-hidden="true" /> Buat Akun
          </PrimaryButton>
        </div>
        <AuthFooter text="Sudah punya akun?" linkText="Masuk" to="/auth/login" />
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
