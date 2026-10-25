import { env } from '../config/env';
import { logger } from '../config/logger';
import { ValidationError } from '../utils/errors';

interface TurnstileVerificationResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export async function verifyCaptcha(token: string | undefined, remoteIp?: string): Promise<void> {
  if (!env.CAPTCHA_ENABLED) return;
  if (!env.CAPTCHA_SECRET_KEY) {
    logger.error('CAPTCHA is enabled but CAPTCHA_SECRET_KEY is missing.');
    throw new ValidationError('Verifikasi keamanan belum dikonfigurasi. Hubungi administrator.');
  }
  if (!token?.trim()) throw new ValidationError('Selesaikan CAPTCHA terlebih dahulu.');

  const isLocalIp = !remoteIp || remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp.startsWith('192.168.') || remoteIp.startsWith('10.') || remoteIp.startsWith('::ffff:127.');
  const form = new URLSearchParams({ secret: env.CAPTCHA_SECRET_KEY, response: token });
  if (remoteIp && !isLocalIp) form.set('remoteip', remoteIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Turnstile returned HTTP ${response.status}`);
    const result = await response.json() as TurnstileVerificationResponse;
    if (!result.success) {
      const errorCodes = result['error-codes'] ?? [];
      logger.warn({ errorCodes }, 'captcha_verification_rejected');
      if (errorCodes.includes('invalid-input-secret') || errorCodes.includes('missing-input-secret')) {
        throw new ValidationError('CAPTCHA_SECRET_KEY di backend/.env salah atau belum diisi dengan Secret Key dari Cloudflare.');
      }
      if (errorCodes.includes('invalid-input-response')) {
        throw new ValidationError('Kunci CAPTCHA tidak cocok: Pastikan CAPTCHA_SECRET_KEY di backend/.env adalah Secret Key dari widget Cloudflare yang sama dengan Site Key di frontend.');
      }
      if (errorCodes.includes('timeout-or-duplicate')) {
        throw new ValidationError('Token CAPTCHA sudah kedaluwarsa atau pernah digunakan. Silakan selesaikan ulang CAPTCHA.');
      }
      throw new ValidationError('Verifikasi CAPTCHA gagal atau kedaluwarsa. Silakan coba lagi.');
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    logger.warn({ error }, 'captcha_verification_unavailable');
    throw new ValidationError('Verifikasi CAPTCHA tidak dapat dihubungi. Periksa koneksi lalu coba lagi.');
  }
}
