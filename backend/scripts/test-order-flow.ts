import { emailService, orderPendingPaymentEmail, orderCompletedWithLicenseEmail } from '../src/services/email.service';
import { notifyTelegramNewOrder, notifyTelegramOrderVerified } from '../src/services/telegram.service';
import { formatJakarta, formatRupiah } from '../src/utils/date';
import { env } from '../src/config/env';

async function main() {
  const targetEmail = process.argv[2] || 'androidstore279@gmail.com';
  const customerName = 'Pelanggan PawangTools';
  const orderId = `TEST-${Date.now().toString().slice(-6)}`;
  const planName = 'Pro Unlimited';
  const durationDays = 30;
  const amountNumber = 150000;
  const amountFormatted = formatRupiah(amountNumber);
  const testLicenseKey = `PAW-TEST-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(-4).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  const checkoutUrl = `${env.APP_URL}/dashboard/subscriptions`;
  const waUrl = `https://wa.me/6285867336036?text=${encodeURIComponent(`Halo PawangTools, saya konfirmasi order #${orderId}`)}`;
  const portalUrl = `${env.APP_URL}/dashboard/licenses`;

  console.log('\n======================================================');
  console.log('🚀 PENGUJIAN ALUR EMAIL ORDER, LISENSI, & BOT TELEGRAM');
  console.log('======================================================');
  console.log(`Target Email   : ${targetEmail}`);
  console.log(`Order ID       : ${orderId}`);
  console.log(`Paket          : ${planName} (${durationDays} Hari)`);
  console.log(`Total          : ${amountFormatted}`);
  console.log(`Test Key       : ${testLicenseKey}`);
  console.log(`Expired        : ${formatJakarta(expiresAt)}`);
  console.log('------------------------------------------------------');

  // 1. Email Pesanan Menunggu Pembayaran
  console.log('\n[1/3] Mengirim Email: Pesanan Harus Dibayar (Pending)...');
  const pendingMail = orderPendingPaymentEmail({
    name: customerName,
    orderId,
    planName,
    durationDays,
    amountFormatted,
    checkoutUrl,
    waUrl,
  });
  pendingMail.to = targetEmail;
  const pendingRes = await emailService.send(pendingMail);
  if (pendingRes.delivered) {
    console.log('  ✅ Email "Menunggu Pembayaran" BERHASIL terkirim ke Gmail!');
  } else {
    console.error(`  ❌ Gagal kirim email pending: ${pendingRes.reason}`);
  }

  // Notifikasi Order Baru ke Telegram
  console.log('\n[2/3] Mengirim Notifikasi Order Baru ke Bot Telegram...');
  await notifyTelegramNewOrder({
    orderId,
    customerEmail: targetEmail,
    planName,
    durationDays,
    amountFormatted,
  });
  console.log('  ✅ Notifikasi order baru terkirim ke bot Telegram.');

  // 2. Email Pembayaran Selesai & Lisensi Diterbitkan
  console.log('\n[3/3] Mengirim Email Selesai + Lisensi & Notifikasi Key ke Telegram...');
  const completedMail = orderCompletedWithLicenseEmail({
    name: customerName,
    orderId,
    planName,
    durationDays,
    amountFormatted,
    licenseKey: testLicenseKey,
    expiresAtFormatted: formatJakarta(expiresAt),
    portalUrl,
  });
  completedMail.to = targetEmail;
  const completedRes = await emailService.send(completedMail);
  if (completedRes.delivered) {
    console.log('  ✅ Email "Pembayaran Berhasil & Kunci Lisensi" BERHASIL terkirim ke Gmail!');
  } else {
    console.error(`  ❌ Gagal kirim email lisensi: ${completedRes.reason}`);
  }

  // Notifikasi Pembayaran Terverifikasi + License Key ke Telegram
  await notifyTelegramOrderVerified({
    orderId,
    customerEmail: targetEmail,
    planName,
    durationDays,
    amountFormatted,
    verifiedAt: new Date(),
    licenseKey: testLicenseKey,
  });
  console.log('  ✅ Notifikasi verifikasi beserta LICENSE KEY terkirim ke bot Telegram!');

  console.log('\n======================================================');
  console.log('🎉 PENGUJIAN SELESAI!');
  console.log(`1. Periksa Gmail (${targetEmail}): Ada 2 email baru (Tagihan & Lisensi Key).`);
  console.log('2. Periksa Telegram: Ada pesan baru berisi konfirmasi & License Key.');
  console.log('======================================================\n');
}

main().catch(console.error);
