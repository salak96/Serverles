import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, HttpError, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LogIn } from 'lucide-react';
import { AuthFooter, AuthShell, FormAlert, FormInput, PasswordInput, PrimaryButton } from './AuthComponents';
import { isCaptchaConfigured, TurnstileCaptcha } from '@/components/TurnstileCaptcha';

const schema = z.object({
  email: z.string().trim().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetTrigger, setCaptchaResetTrigger] = useState(0);
  const captchaRequired = isCaptchaConfigured();

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setNotice(state.message);
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });

  const onSubmit = async (data: FormData): Promise<void> => {
    setServerError(null);
    setNotice(null);
    try {
      const login = await api<{ accessToken?: string }>('/auth/login', { method: 'POST', body: { ...data, ...(captchaRequired ? { captchaToken } : {}) } });
      setAccessToken(login.accessToken ?? null);
      const me = await api<{ id: string; name: string; email: string; role: 'USER' | 'ADMIN'; status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'; emailVerified: boolean; lastLoginAt: string | null; createdAt: string }>('/auth/me', {
        headers: login.accessToken ? { Authorization: `Bearer ${login.accessToken}` } : undefined,
      });
      setUser(me);
      const next = searchParams.get('next') || '/dashboard';
      navigate(next, { replace: true });
    } catch (e) {
      setCaptchaToken('');
      setCaptchaResetTrigger((prev) => prev + 1);
      if (e instanceof HttpError) setServerError(e.message);
      else setServerError('Tidak dapat menghubungi server. Coba lagi.');
    }
  };

  return (
    <AuthShell title="Masuk ke PawangTools" subtitle="Kelola langganan, lisensi, dan tools Anda.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {notice && <FormAlert variant="success">{notice}</FormAlert>}
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
          placeholder="Masukkan password"
          autoComplete="current-password"
          error={errors.password?.message}
          labelAction={
            <Link to="/auth/forgot-password" className="text-[13px] font-medium text-accent hover:text-accent-hover focus:outline-none focus-visible:underline">
              Lupa password?
            </Link>
          }
          {...register('password')}
        />
        {captchaRequired && <TurnstileCaptcha onToken={setCaptchaToken} resetTrigger={captchaResetTrigger} />}
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <div className="pt-1">
          <PrimaryButton loading={isSubmitting} disabled={captchaRequired && !captchaToken} loadingText="Memproses...">
            <LogIn className="w-[18px] h-[18px]" aria-hidden="true" /> Masuk
          </PrimaryButton>
        </div>
        <AuthFooter text="Belum punya akun?" linkText="Daftar" to="/auth/register" />
      </form>
    </AuthShell>
  );
}
