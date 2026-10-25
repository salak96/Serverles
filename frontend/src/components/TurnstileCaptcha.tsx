import { useEffect, useRef, useState } from 'react';

interface TurnstileApi {
  render: (container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: () => void;
    theme?: 'dark' | 'light' | 'auto';
  }) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const rawKey = (import.meta as unknown as { env?: { VITE_TURNSTILE_SITE_KEY?: string } }).env?.VITE_TURNSTILE_SITE_KEY?.trim();
const isDisabled = rawKey === 'disabled' || rawKey === 'false' || rawKey === 'off' || rawKey === 'none';

/**
 * Cloudflare Turnstile official test site key ('1x00000000000000000000AA' always passes on localhost/dev).
 * In production or custom setup, configure VITE_TURNSTILE_SITE_KEY in .env.
 */
export const TURNSTILE_DEFAULT_SITE_KEY = '1x00000000000000000000AA';
const siteKey = isDisabled ? '' : (rawKey || TURNSTILE_DEFAULT_SITE_KEY);

export function isCaptchaConfigured(): boolean {
  return Boolean(siteKey);
}

export function TurnstileCaptcha({ onToken, resetTrigger }: { onToken: (token: string) => void; resetTrigger?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [error, setError] = useState('');
  onTokenRef.current = onToken;

  useEffect(() => {
    if (resetTrigger && widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
        onTokenRef.current('');
      } catch {
        // ignore
      }
    }
  }, [resetTrigger]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    const render = (): void => {
      if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token) => { setError(''); onTokenRef.current(token); },
        'expired-callback': () => onTokenRef.current(''),
        'error-callback': (errorCode?: string) => {
          onTokenRef.current('');
          if (errorCode === '110200') {
            setError(`Domain "${window.location.hostname}" belum didaftarkan di widget Cloudflare Turnstile Anda (Error 110200). Tambahkan "${window.location.hostname}" di Cloudflare Dashboard > Turnstile > Widget Anda > Domains.`);
          } else if (errorCode === '110100' || errorCode === '110110') {
            setError(`Site Key Cloudflare Turnstile tidak valid (Error ${errorCode}). Periksa kembali VITE_TURNSTILE_SITE_KEY di frontend/.env.`);
          } else {
            setError(`CAPTCHA gagal dimuat${errorCode ? ` (${errorCode})` : ''}. Muat ulang halaman lalu coba lagi.`);
          }
        },
      });
    };

    // Attach global callback for immediate explicit initialization
    (window as unknown as { onloadTurnstileCallback?: () => void }).onloadTurnstileCallback = () => {
      render();
    };

    if (!document.querySelector('script[data-turnstile-script]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onloadTurnstileCallback';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = 'true';
      script.onerror = () => setError('CAPTCHA tidak dapat dimuat. Periksa koneksi Anda.');
      document.head.appendChild(script);
    }

    render();
    const pollTimer = window.setInterval(render, 150);
    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
      widgetIdRef.current = null;
    };
  }, []);

  if (!siteKey) return null;
  return (
    <div className="my-2">
      <div ref={containerRef} className="min-h-[65px] flex justify-center" />
      {error && <p role="alert" className="mt-1 text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
