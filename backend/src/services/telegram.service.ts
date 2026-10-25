import { env } from '../config/env';
import { logger } from '../config/logger';

interface NewOrderAlertInput {
  orderId: string;
  customerEmail: string;
  planName: string;
  durationDays: number;
  amountFormatted: string;
}

interface VerifiedOrderAlertInput extends NewOrderAlertInput {
  verifiedAt: Date;
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return 'email disamarkan';
  const visible = localPart.length <= 2 ? localPart.slice(0, 1) : localPart.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
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
