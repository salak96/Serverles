import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, HttpError } from '@/lib/api';
import { AuthShell } from './AuthComponents';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState<string>(token ? 'Memverifikasi...' : 'Token tidak ditemukan di URL.');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        await api('/auth/verify-email', { method: 'POST', body: { token } });
        if (cancelled) return;
        setState('success');
        setMessage('Email berhasil diverifikasi. Anda dapat masuk sekarang.');
      } catch (e) {
        if (cancelled) return;
        setState('error');
        setMessage(e instanceof HttpError ? e.message : 'Verifikasi gagal.');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <AuthShell title="Verifikasi email" subtitle="PawangTools">
      <div className="text-center space-y-4">
        {state === 'loading' && <Loader2 className="w-10 h-10 mx-auto text-accent animate-spin" />}
        {state === 'success' && <CheckCircle2 className="w-10 h-10 mx-auto text-success" />}
        {state === 'error' && <XCircle className="w-10 h-10 mx-auto text-danger" />}
        <p className="text-ink-muted text-sm">{message}</p>
        {state === 'success' && (
          <button className="btn btn-primary w-full" onClick={() => navigate('/auth/login')}>Masuk sekarang</button>
        )}
        {state === 'error' && (
          <button className="btn btn-secondary w-full" onClick={() => navigate('/auth/login')}>Kembali ke masuk</button>
        )}
      </div>
    </AuthShell>
  );
}
