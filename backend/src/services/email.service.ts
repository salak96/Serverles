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

export interface OrderPendingPaymentParams {
  name: string;
  orderId: string;
  planName: string;
  durationDays: number;
  amountFormatted: string;
  checkoutUrl: string;
  waUrl: string;
}

export function orderPendingPaymentEmail(params: OrderPendingPaymentParams): EmailParams {
  const html = `
  <!doctype html><html><body style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0B0D12;color:#F5F5F5;padding:32px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#151922;border:1px solid #272C36;border-radius:12px;padding:32px">
    <div style="border-bottom:1px solid #272C36;padding-bottom:16px;margin-bottom:24px">
      <h1 style="color:#FF8A00;margin:0;font-size:24px">PawangTools</h1>
      <p style="color:#9CA3AF;font-size:13px;margin:4px 0 0">Menunggu Pembayaran Pesanan #${escapeHtml(params.orderId)}</p>
    </div>

    <p style="font-size:15px;line-height:1.6">Halo <strong>${escapeHtml(params.name)}</strong>,</p>
    <p style="font-size:14px;color:#D1D5DB;line-height:1.6">Pesanan Anda untuk paket <strong>${escapeHtml(params.planName)}</strong> telah berhasil dibuat. Silakan selesaikan pembayaran untuk mengaktifkan lisensi Anda.</p>

    <div style="background:#0E121A;border:1px solid #272C36;border-radius:8px;padding:20px;margin:24px 0">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;border-bottom:1px dashed #272C36;padding-bottom:10px">
        <span style="color:#9CA3AF;font-size:13px">ID Pesanan:</span>
        <strong style="color:#F5F5F5;font-size:13px;font-family:monospace">${escapeHtml(params.orderId)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;border-bottom:1px dashed #272C36;padding-bottom:10px">
        <span style="color:#9CA3AF;font-size:13px">Paket Langganan:</span>
        <strong style="color:#F5F5F5;font-size:13px">${escapeHtml(params.planName)} (${params.durationDays} Hari)</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px">
        <span style="color:#9CA3AF;font-size:14px">Total Pembayaran:</span>
        <strong style="color:#FF8A00;font-size:20px">${escapeHtml(params.amountFormatted)}</strong>
      </div>
    </div>

    <p style="font-size:13px;color:#9CA3AF;margin-bottom:8px">Metode Pembayaran:</p>
    <ul style="font-size:13px;color:#D1D5DB;padding-left:20px;line-height:1.6;margin-top:0">
      <li>Pindai QRIS yang tersedia pada halaman detail pesanan.</li>
      <li>Pastikan jumlah transfer sesuai hingga digit terakhir.</li>
      <li>Konfirmasikan bukti transfer untuk percepatan aktivasi.</li>
    </ul>

    <div style="text-align:center;margin:32px 0 24px">
      <a href="${params.checkoutUrl}" style="background:#FF8A00;color:#0B0D12;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;margin-right:8px">Buka Halaman Pembayaran</a>
      <a href="${params.waUrl}" style="background:#22C55E;color:#0B0D12;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Konfirmasi WhatsApp</a>
    </div>

    <p style="color:#6B7280;font-size:12px;border-top:1px solid #272C36;padding-top:16px;margin-top:24px;text-align:center">
      Jika Anda telah membayar, lisensi akan otomatis aktif setelah pembayaran diverifikasi oleh tim kami.
    </p>
  </div>
  </body></html>`;

  return {
    to: '',
    subject: `[PawangTools] Menunggu Pembayaran: Order #${params.orderId} - ${params.planName}`,
    html,
  };
}

export interface OrderCompletedWithLicenseParams {
  name: string;
  orderId: string;
  planName: string;
  durationDays: number;
  amountFormatted: string;
  licenseKey: string;
  expiresAtFormatted: string;
  portalUrl: string;
}

export function orderCompletedWithLicenseEmail(params: OrderCompletedWithLicenseParams): EmailParams {
  const html = `
  <!doctype html><html><body style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0B0D12;color:#F5F5F5;padding:32px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#151922;border:1px solid #272C36;border-radius:12px;padding:32px">
    <div style="border-bottom:1px solid #272C36;padding-bottom:16px;margin-bottom:24px">
      <h1 style="color:#FF8A00;margin:0;font-size:24px">PawangTools</h1>
      <p style="color:#22C55E;font-size:14px;font-weight:600;margin:4px 0 0">✅ Pembayaran Berhasil &amp; Lisensi Aktif</p>
    </div>

    <p style="font-size:15px;line-height:1.6">Halo <strong>${escapeHtml(params.name)}</strong>,</p>
    <p style="font-size:14px;color:#D1D5DB;line-height:1.6">Terima kasih atas pembayaran Anda! Pesanan <strong>#${escapeHtml(params.orderId)}</strong> untuk paket <strong>${escapeHtml(params.planName)}</strong> telah diverifikasi dan lisensi Anda sudah siap digunakan.</p>

    <!-- License Key Highlight Box -->
    <div style="background:#0E121A;border:2px solid #FF8A00;border-radius:10px;padding:24px;margin:28px 0;text-align:center">
      <span style="color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700">KUNCI LISENSI ANDA (LICENSE KEY)</span>
      <div style="background:#151922;border:1px dashed #FF8A00;border-radius:6px;padding:14px;margin:12px 0;font-family:Consolas,Monaco,'Courier New',monospace;font-size:20px;font-weight:700;color:#FF8A00;letter-spacing:2px;word-break:break-all;user-select:all">
        ${escapeHtml(params.licenseKey)}
      </div>
      <p style="color:#9CA3AF;font-size:12px;margin:0">Simpan kunci ini atau salin langsung ke aplikasi desktop PawangTools.</p>
    </div>

    <div style="background:#0E121A;border:1px solid #272C36;border-radius:8px;padding:18px;margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <span style="color:#9CA3AF;font-size:13px">Paket:</span>
        <strong style="color:#F5F5F5;font-size:13px">${escapeHtml(params.planName)} (${params.durationDays} Hari)</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <span style="color:#9CA3AF;font-size:13px">Total Dibayar:</span>
        <strong style="color:#F5F5F5;font-size:13px">${escapeHtml(params.amountFormatted)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:#9CA3AF;font-size:13px">Masa Berlaku Hingga:</span>
        <strong style="color:#22C55E;font-size:13px">${escapeHtml(params.expiresAtFormatted)}</strong>
      </div>
    </div>

    <h3 style="color:#F5F5F5;font-size:15px;margin:24px 0 8px">Cara Menggunakan Lisensi:</h3>
    <ol style="font-size:13px;color:#D1D5DB;padding-left:20px;line-height:1.8;margin:0 0 24px">
      <li>Buka aplikasi desktop <strong>PawangTools</strong> di komputer Anda.</li>
      <li>Masukkan <strong>License Key</strong> yang tertera di atas.</li>
      <li>Klik <strong>Aktivasi Perangkat</strong> untuk mulai menggunakan tools.</li>
    </ol>

    <div style="text-align:center;margin:28px 0">
      <a href="${params.portalUrl}" style="background:#FF8A00;color:#0B0D12;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Buka Portal Lisensi Saya</a>
    </div>

    <p style="color:#6B7280;font-size:12px;border-top:1px solid #272C36;padding-top:16px;text-align:center">
      Butuh bantuan? Hubungi tim support kami melalui WhatsApp atau portal bantuan PawangTools.
    </p>
  </div>
  </body></html>`;

  return {
    to: '',
    subject: `[PawangTools] Pembayaran Berhasil! Lisensi Anda: ${params.planName} #${params.orderId}`,
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
