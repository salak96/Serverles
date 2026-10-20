import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, HttpError } from '@/lib/api';
import { KeyRound } from 'lucide-react';
import { AuthShell, FormAlert, PasswordInput, PrimaryButton } from './AuthComponents';

const schema = z.object({
  password: z.string().min(8, 'Password minimal 8 karakter.').max(128, 'Password maksimal 128 karakter.'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi.'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.', path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onTouched' });
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (data: FormData): Promise<void> => {
    setServerError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password: data.password, confirmPassword: data.confirmPassword } });
      setDone(true);
      setTimeout(() => navigate('/auth/login'), 1500);
    } catch (e) {
      setServerError(e instanceof HttpError ? e.message : 'Reset gagal.');
    }
  };

  if (!token) {
    return (
      <AuthShell title="Tautan tidak valid" subtitle="Tautan reset tidak lengkap. Minta tautan baru dari halaman lupa password.">
        <Link to="/auth/forgot-password" className="btn btn-secondary w-full h-12 rounded-[10px]">Minta tautan baru</Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password diubah" subtitle="Anda akan diarahkan ke halaman masuk.">
        <FormAlert variant="success">Kata sandi berhasil direset. Mengalihkan...</FormAlert>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Atur ulang password" subtitle="Masukkan password baru untuk akun Anda.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <PasswordInput
          label="Password baru"
          placeholder="Minimal 8 karakter"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label="Konfirmasi password"
          placeholder="Ulangi password baru"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <div className="pt-1">
          <PrimaryButton loading={isSubmitting} loadingText="Menyimpan...">
            <KeyRound className="w-[18px] h-[18px]" aria-hidden="true" /> Simpan password baru
          </PrimaryButton>
        </div>
      </form>
    </AuthShell>
  );
}
