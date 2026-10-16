import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface LocationState { reason?: string }

/**
 * SECURITY BREACH DETECTED page.
 *
 * Renders ONLY when the security detector has latched a breach. The page
 * does not itself run any detection — the parent App is responsible for
 * routing the user here. This separation means the page cannot itself
 * be bypassed by tampering with the detector.
 */
export function SecurityBreachPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const reason = (location.state as LocationState | null)?.reason;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // If the user lands here without being authenticated (already logged out
  // elsewhere), the "Back to Login" button still works. We don't auto-
  // redirect because the user must consciously dismiss the page.

  const goLogin = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await logout();
      navigate('/auth/login', { replace: true });
    } catch {
      setErr('Gagal mengakhiri sesi. Coba lagi.');
      setBusy(false);
    }
  };

  useEffect(() => {
    // Prevent scroll restoration from masking the page.
    document.title = 'Security Breach Detected — PawangTools';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-8">
      <div className="card max-w-md w-full !p-0 overflow-hidden">
        <div className="h-1.5 bg-danger" aria-hidden="true" />
        <div className="p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-danger/15 text-danger flex items-center justify-center">
            <ShieldAlert className="w-9 h-9" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] tracking-[0.2em] font-semibold text-danger uppercase">
              Security Notice
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1 text-ink">
              SECURITY BREACH DETECTED
            </h1>
          </div>
          <p className="text-ink-muted text-sm leading-relaxed">
            Developer Tools terdeteksi aktif. Sesi akun Anda dihentikan secara otomatis
            dan dikeluarkan demi alasan keamanan.
          </p>
          {reason && (
            <p className="text-[11px] text-ink-muted/80 font-mono break-all" aria-hidden="true">
              ref: {reason}
            </p>
          )}
          {err && (
            <p role="alert" className="text-xs text-danger">{err}</p>
          )}
          <button
            type="button"
            onClick={goLogin}
            disabled={busy}
            className="btn btn-primary w-full"
            aria-label="Kembali ke halaman login"
          >
            {busy ? 'Mengakhiri sesi...' : (
              <>
                <LogOut className="w-4 h-4" /> Kembali ke Login
              </>
            )}
          </button>
          <p className="text-[11px] text-ink-muted/70">
            Jika Anda merasa ini adalah kesalahan, hubungi administrator setelah masuk kembali.
          </p>
        </div>
      </div>
    </div>
  );
}
