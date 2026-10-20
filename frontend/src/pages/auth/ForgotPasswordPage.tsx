import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, HttpError } from '@/lib/api';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { AuthShell, FormAlert, FormInput, PrimaryButton, StatusIcon } from './AuthComponents';

const schema = z.object({ email: z.string().trim().email('Format email tidak valid.') });
type FormData = z.infer<typeof schema>;

function BackToLogin() {
  return (
    <p className="text-center text-sm pt-5 mt-1 border-t border-line/70">
      <Link to="/auth/login" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:text-accent-hover focus:outline-none focus-visible:underline">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Kembali ke Login
      </Link>
    </p>
  );
}

export function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onTouched' });
  const [submitted, setSubmitted] = useState<{ configured: boolean } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: FormData): Promise<void> => {
    setServerError(null);
    try {
      const res = await api<{ message: string; emailDelivery: { configured: boolean } }>('/auth/forgot-password', { method: 'POST', body: data });
      setSubmitted(res.emailDelivery);
    } catch (e) {
      if (!(e instanceof HttpError)) {
        setServerError('Tidak dapat menghubungi server. Periksa koneksi Anda lalu coba lagi.');
      } else if (e.status === 429) {
        setServerError('Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi.');
      } else if (e.status === 400) {
        setServerError(e.message || 'Periksa kembali alamat email Anda.');
      } else {
        // Server failures can depend on whether the account exists, so keep the response neutral.
        setSubmitted({ configured: true });
      }
    }
  };

  if (submitted) {
    return (
      <AuthShell title="Periksa email Anda" subtitle="Jika email terdaftar, instruksi pemulihan password telah dikirim.">
        <div className="text-center space-y-5">
          <StatusIcon><Mail className="w-6 h-6" /></StatusIcon>
          <p className="text-ink-muted text-sm leading-relaxed">Tautan reset berlaku selama 1 jam. Jika tidak menerima email, periksa folder spam atau hubungi admin.</p>
          {!submitted.configured && (
            <FormAlert variant="warning">SMTP belum dikonfigurasi. Tautan reset dicatat ke log server pada mode pengembangan.</FormAlert>
          )}
          <BackToLogin />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Lupa Password?" subtitle="Masukkan email Anda untuk menerima instruksi pemulihan password.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormInput
          label="Email"
          type="email"
          inputMode="email"
          placeholder="nama@email.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <div className="pt-1">
          <PrimaryButton loading={isSubmitting} loadingText="Mengirim...">
            <Send className="w-[18px] h-[18px]" aria-hidden="true" /> Kirim Instruksi Reset
          </PrimaryButton>
        </div>
        <BackToLogin />
      </form>
    </AuthShell>
  );
}
