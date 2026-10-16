import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, HttpError, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui';
import { Eye, EyeOff, LogIn } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setServerError(state.message);
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData): Promise<void> => {
    setServerError(null);
    try {
      const login = await api<{ accessToken?: string }>('/auth/login', { method: 'POST', body: data });
      setAccessToken(login.accessToken ?? null);
      const me = await api<{ id: string; name: string; email: string; role: 'USER' | 'ADMIN'; status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'; emailVerified: boolean; lastLoginAt: string | null; createdAt: string }>('/auth/me', {
        headers: login.accessToken ? { Authorization: `Bearer ${login.accessToken}` } : undefined,
      });
      setUser(me);
      const next = searchParams.get('next') || '/dashboard';
      navigate(next, { replace: true });
    } catch (e) {
      if (e instanceof HttpError) setServerError(e.message);
      else setServerError('Tidak dapat menghubungi server. Coba lagi.');
    }
  };

  return (
    <AuthShell title="Masuk ke PawangTools" subtitle="Kelola langganan, lisensi, dan tools Anda.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              autoComplete="current-password"
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
        </div>
        {serverError && (
          <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg px-3 py-2">{serverError}</div>
        )}
        <div className="flex items-center justify-between text-sm">
          <Link to="/auth/forgot-password" className="text-accent hover:underline">Lupa password?</Link>
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Memproses...' : <><LogIn className="w-4 h-4" /> Masuk</>}
        </button>
        <p className="text-center text-sm text-ink-muted">
          Belum punya akun? <Link to="/auth/register" className="text-accent hover:underline">Daftar</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="mb-6 flex items-center gap-2">
        <div className="w-10 h-10 rounded-md bg-accent text-bg flex items-center justify-center font-bold text-lg">P</div>
        <div>
          <div className="font-semibold">PawangTools</div>
          <div className="text-xs text-ink-muted">Membership & License Portal</div>
        </div>
      </div>
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold mb-1">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mb-6">{subtitle}</p>}
        {children}
      </Card>
    </div>
  );
}