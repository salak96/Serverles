import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, HttpError } from '@/lib/api';
import { AuthShell } from './LoginPage';

const schema = z.object({
  password: z.string().min(8, 'Password minimal 8 karakter.'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.', path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
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
      <AuthShell title="Tautan tidak valid">
        <p className="text-ink-muted text-sm mb-4">Tautan reset tidak lengkap. Minta tautan baru dari halaman lupa password.</p>
        <Link to="/auth/forgot-password" className="btn btn-secondary w-full">Minta tautan baru</Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password diubah" subtitle="Anda akan diarahkan ke halaman masuk.">
        <p className="text-success text-sm">Kata sandi berhasil direset. Mengalihkan...</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Atur ulang password" subtitle="Masukkan password baru untuk akun Anda.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Password baru</label>
          <input className="input" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="label">Konfirmasi password</label>
          <input className="input" type="password" autoComplete="new-password" {...register('confirmPassword')} />
          {errors.confirmPassword && <p className="text-xs text-danger mt-1">{errors.confirmPassword.message}</p>}
        </div>
        {serverError && <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg px-3 py-2">{serverError}</div>}
        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : 'Simpan password baru'}
        </button>
      </form>
    </AuthShell>
  );
}
