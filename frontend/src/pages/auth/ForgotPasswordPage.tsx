import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, HttpError } from '@/lib/api';
import { AuthShell } from './LoginPage';
import { Mail } from 'lucide-react';

const schema = z.object({ email: z.string().email('Format email tidak valid.') });
type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [submitted, setSubmitted] = useState<{ configured: boolean } | null>(null);

  const onSubmit = async (data: FormData): Promise<void> => {
    try {
      const res = await api<{ message: string; emailDelivery: { configured: boolean } }>('/auth/forgot-password', { method: 'POST', body: data });
      setSubmitted(res.emailDelivery);
    } catch (e) {
      if (e instanceof HttpError) setSubmitted({ configured: true });
    }
  };

  if (submitted) {
    return (
      <AuthShell title="Periksa email Anda" subtitle="Tautan reset telah dikirim jika email terdaftar.">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-accent/20 text-accent flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
          <p className="text-ink-muted text-sm">Tautan reset berlaku selama 1 jam. Jika tidak menerima email, periksa folder spam atau hubungi admin.</p>
          {!submitted.configured && (
            <div className="bg-warning/10 border border-warning/30 text-warning text-xs rounded-lg px-3 py-2">
              SMTP belum dikonfigurasi. Tautan reset dicatat ke log server pada mode pengembangan.
            </div>
          )}
          <Link to="/auth/login" className="btn btn-secondary w-full">Kembali ke masuk</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Lupa password" subtitle="Kami akan mengirim tautan reset ke email Anda.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Mengirim...' : 'Kirim tautan reset'}
        </button>
        <p className="text-center text-sm text-ink-muted">
          <Link to="/auth/login" className="text-accent hover:underline">Kembali ke masuk</Link>
        </p>
      </form>
    </AuthShell>
  );
}
