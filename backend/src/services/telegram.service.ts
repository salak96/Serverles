import { env } from '../config/env';
import { logger } from '../config/logger';
import { formatJakarta } from '../utils/date';

interface NewOrderAlertInput {
  orderId: string;
  customerEmail: string;
  planName: string;
  durationDays: number;
  amountFormatted: string;
}

export interface VerifiedOrderAlertInput extends NewOrderAlertInput {
  verifiedAt: Date;
  licenseKey?: string;
}

export interface DeviceConnectedAlertInput {
  customerEmail: string;
  planName: string;
  activeDevices: number;
  maxDevices: number;
  expiresAt: Date;
  licenseStatus: string;
  deviceName: string | null;
  platform: string | null;
  appVersion: string | null;
  maskedDeviceId: string;
  lastSeenAt: Date;
}

export interface LicenseSecurityAlertInput {
  event: 'api_key_rotated' | 'device_unbound' | 'device_reset_completed' | 'device_reset_requested';
  customerEmail: string;
  planName: string;
  licenseStatus: string;
  maskedDeviceId?: string;
  deviceName?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  nextAvailableAt?: Date | null;
  occurredAt: Date;
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return 'email disamarkan';
  const visible = localPart.length <= 2 ? localPart.slice(0, 1) : localPart.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export function maskLicenseKeyForTelegram(key: string): string {
  const parts = key.split('-');
  if (parts.length >= 4) {
    const head = parts.slice(0, 2).join('-');
    const tail = parts[parts.length - 1];
    const middle = parts.slice(2, -1).map(() => '****').join('-');
    return `${head}-${middle}-${tail}`;
  }
  if (parts.length === 3) {
    return `${parts[0]}-****-${parts[2]}`;
  }
  if (key.length <= 8) return key;
  const start = key.slice(0, 4);
  const end = key.slice(-4);
  return `${start}-****-${end}`;
}

export async function notifyTelegramLicenseSecurityEvent(input: LicenseSecurityAlertInput): Promise<void> {
  const { BOT_TOKEN, CHAT_ID } = env.TELEGRAM;
  if (!BOT_TOKEN || !CHAT_ID) return;

  const eventLabels: Record<LicenseSecurityAlertInput['event'], string> = {
    api_key_rotated: 'API key lisensi dirotasi',
    device_unbound: 'Perangkat dilepas dari lisensi',
    device_reset_completed: 'Reset perangkat selesai',
    device_reset_requested: 'Permintaan reset perangkat',
  };
  const text = [
    `🔐 ${eventLabels[input.event]}`,
    `Email: ${maskEmail(input.customerEmail)}`,
    `Paket: ${input.planName}`,
    `Status lisensi: ${input.licenseStatus}`,
    ...(input.deviceName ? [`Perangkat: ${input.deviceName}`] : []),
    ...(input.platform || input.appVersion ? [`Platform/versi: ${input.platform ?? '—'} · ${input.appVersion ?? '—'}`] : []),
    ...(input.maskedDeviceId ? [`HWID: ${input.maskedDeviceId}`] : []),
    ...(input.nextAvailableAt ? [`Reset berikutnya: ${formatJakarta(input.nextAvailableAt)}`] : []),
    `Waktu: ${formatJakarta(input.occurredAt)}`,
  ].join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; description?: string; error_code?: number } | null;
    if (!response.ok || !result?.ok) {
      logger.warn({ statusCode: response.status, telegramErrorCode: result?.error_code, reason: result?.description, event: input.event }, 'telegram_license_security_event_failed');
      return;
    }
    logger.info({ event: input.event }, 'telegram_license_security_event_sent');
  } catch (error) {
    logger.warn({ error, event: input.event }, 'telegram_license_security_event_failed');
  }
}

export interface AdminNotificationInput {
  title: string;
  body: string;
  category: string;
  link?: string;
  recipientLabel: string;
}

export interface TelegramDeliveryResult {
  configured: boolean;
  delivered: boolean;
  reason?: string;
}

export async function sendTelegramAdminNotification(input: AdminNotificationInput): Promise<TelegramDeliveryResult> {
  const { BOT_TOKEN, CHAT_ID } = env.TELEGRAM;
  if (!BOT_TOKEN || !CHAT_ID) return { configured: false, delivered: false };

  const text = [
    `📢 ${input.title}`,
    '',
    input.body,
    '',
    `Kategori: ${input.category}`,
    `Penerima aplikasi: ${input.recipientLabel}`,
    ...(input.link ? [`Link: ${input.link}`] : []),
  ].join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: text.slice(0, 4096), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; description?: string; error_code?: number } | null;
    if (!response.ok || !result?.ok) {
      const reason = result?.description ?? `Telegram menolak permintaan (HTTP ${response.status}).`;
      logger.warn({ statusCode: response.status, telegramErrorCode: result?.error_code, reason }, 'telegram_admin_notification_failed');
      return { configured: true, delivered: false, reason };
    }
    return { configured: true, delivered: true };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError'
      ? 'Waktu tunggu Telegram habis.'
      : 'Tidak dapat terhubung ke Telegram. Periksa koneksi server.';
    logger.warn({ error }, 'telegram_admin_notification_failed');
    return { configured: true, delivered: false, reason };
  }
}

export async function notifyTelegramNewOrder(input: NewOrderAlertInput): Promise<void> {
  const { BOT_TOKEN, CHAT_ID } = env.TELEGRAM;
  if (!BOT_TOKEN || !CHAT_ID) return;

  const text = [
    '🛒 Order baru masuk',
    `ID: ${input.orderId}`,
    `Email: ${maskEmail(input.customerEmail)}`,
    `Paket: ${input.planName}`,
    `Durasi: ${input.durationDays} hari`,
    `Total: ${input.amountFormatted}`,
  ].join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
      signal: AbortSignal.timeout(10_000),
    });

    const result = await response.json().catch(() => null) as { ok?: boolean; description?: string; error_code?: number } | null;
    if (!response.ok || !result?.ok) {
      logger.warn({ statusCode: response.status, telegramErrorCode: result?.error_code, reason: result?.description }, 'telegram_order_notification_failed');
      return;
    }
    logger.info({ orderId: input.orderId }, 'telegram_order_notification_sent');
  } catch (error) {
    logger.warn({ error }, 'telegram_order_notification_failed');
  }
}

export async function notifyTelegramOrderVerified(input: VerifiedOrderAlertInput): Promise<void> {
  const { BOT_TOKEN, CHAT_ID } = env.TELEGRAM;
  if (!BOT_TOKEN || !CHAT_ID) return;

  const text = [
    '✅ Pembayaran terverifikasi',
    `ID Order: ${input.orderId}`,
    `Email: ${maskEmail(input.customerEmail)}`,
    `Paket: ${input.planName}`,
    `Durasi: ${input.durationDays} hari`,
    `Total: ${input.amountFormatted}`,
    ...(input.licenseKey ? [`🔑 License Key: ${maskLicenseKeyForTelegram(input.licenseKey)}`] : []),
    `Waktu verifikasi: ${input.verifiedAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
  ].join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; description?: string; error_code?: number } | null;
    if (!response.ok || !result?.ok) {
      logger.warn({ statusCode: response.status, telegramErrorCode: result?.error_code, reason: result?.description }, 'telegram_verified_order_notification_failed');
      return;
    }
    logger.info({ orderId: input.orderId }, 'telegram_verified_order_notification_sent');
  } catch (error) {
    logger.warn({ error }, 'telegram_verified_order_notification_failed');
  }
}

export async function notifyTelegramDeviceConnected(input: DeviceConnectedAlertInput): Promise<void> {
  const { BOT_TOKEN, CHAT_ID } = env.TELEGRAM;
  if (!BOT_TOKEN || !CHAT_ID) return;

  const text = [
    '🖥️ Perangkat baru terhubung',
    `Email: ${maskEmail(input.customerEmail)}`,
    `Paket ${input.planName}`,
    `${input.activeDevices}/${input.maxDevices} perangkat · berakhir ${formatJakarta(input.expiresAt)}`,
    `Status: ${input.licenseStatus}`,
    input.deviceName ?? 'Perangkat tanpa nama',
    `${input.platform ?? 'platform tidak diketahui'} · ${input.appVersion ?? 'versi tidak diketahui'}`,
    `HWID: ${input.maskedDeviceId}`,
    `Terakhir aktif: ${formatJakarta(input.lastSeenAt)}`,
  ].join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; description?: string; error_code?: number } | null;
    if (!response.ok || !result?.ok) {
      logger.warn({ statusCode: response.status, telegramErrorCode: result?.error_code, reason: result?.description }, 'telegram_device_connected_notification_failed');
      return;
    }
    logger.info({ planName: input.planName, licenseStatus: input.licenseStatus }, 'telegram_device_connected_notification_sent');
  } catch (error) {
    logger.warn({ error }, 'telegram_device_connected_notification_failed');
  }
}
