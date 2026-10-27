import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!env.SMTP.ENABLED) return null;
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: env.SMTP.HOST,
    port: env.SMTP.PORT,
    secure: env.SMTP.SECURE,
    auth: { user: env.SMTP.USER, pass: env.SMTP.PASSWORD },
    pool: true,
    maxConnections: 3,
  });
  return cachedTransport;
}

export const emailService = {
  isConfigured(): boolean {
    return env.SMTP.ENABLED;
  },

  async verifyConnection(): Promise<{ connected: boolean; reason?: string }> {
    const transport = getTransport();
    if (!transport) return { connected: false, reason: 'smtp_not_configured' };
    try {
      await transport.verify();
      logger.info({ host: env.SMTP.HOST, port: env.SMTP.PORT }, 'smtp_connection_verified');
      return { connected: true };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'smtp_connection_failed';
      logger.error({ err: e, host: env.SMTP.HOST, port: env.SMTP.PORT, reason }, 'smtp_connection_failed');
      return { connected: false, reason };
    }
  },

  /**
   * Send an email. If SMTP is not configured, the email is logged (without
   * sensitive content) for development visibility. The caller is expected
   * to handle delivery status — we do not lie to the user that the mail
   * was sent if delivery actually failed.
   */
  async send(params: EmailParams): Promise<{ delivered: boolean; reason?: string }> {
    const transport = getTransport();
    if (!transport) {
      logger.warn(
        { to: params.to, subject: params.subject, mode: 'dev-log' },
        'email_skipped_smtp_not_configured'
      );
      return { delivered: false, reason: 'smtp_not_configured' };
    }
    try {
      await transport.sendMail({
        from: env.SMTP.FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text ?? params.html.replace(/<[^>]+>/g, ''),
      });
      return { delivered: true };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'send_failed';
      logger.error({ err: e, to: params.to, subject: params.subject, reason }, 'email_send_failed');
      return { delivered: false, reason };
    }
  },
};

export function verificationEmail(params: { name: string; verifyUrl: string }): EmailParams {
  const html = `
  <!doctype html><html><body style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0B0D12;color:#F5F5F5;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#151922;border:1px solid #272C36;border-radius:12px;padding:32px">
    <h1 style="color:#FF8A00;margin:0 0 16px">PawangTools</h1>
    <p>Halo ${escapeHtml(params.name)},</p>
    <p>Terima kasih telah mendaftar. Klik tombol di bawah ini untuk memverifikasi email Anda.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${params.verifyUrl}" style="background:#FF8A00;color:#0B0D12;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Verifikasi Email</a>
    </p>
    <p>Atau salin tautan berikut ke browser Anda:</p>
    <p style="word-break:break-all;color:#9CA3AF">${params.verifyUrl}</p>
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px">Tautan ini berlaku selama 24 jam. Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
  </div>
  </body></html>`;
  return {
    to: '',
    subject: 'Verifikasi email PawangTools Anda',
    html,
  };
}

export function passwordResetEmail(params: { name: string; resetUrl: string }): EmailParams {
  const html = `
  <!doctype html><html><body style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0B0D12;color:#F5F5F5;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#151922;border:1px solid #272C36;border-radius:12px;padding:32px">
    <h1 style="color:#FF8A00;margin:0 0 16px">PawangTools</h1>
    <p>Halo ${escapeHtml(params.name)},</p>
    <p>Kami menerima permintaan untuk mengatur ulang kata sandi Anda. Klik tombol di bawah untuk melanjutkan.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${params.resetUrl}" style="background:#FF8A00;color:#0B0D12;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Atur Ulang Kata Sandi</a>
    </p>
    <p>Tautan ini berlaku selama 1 jam. Jika Anda tidak meminta reset, abaikan email ini dan kata sandi Anda tidak berubah.</p>
  </div>
  </body></html>`;
  return {
    to: '',
    subject: 'Reset kata sandi PawangTools',
    html,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
