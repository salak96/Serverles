import { emailService } from '../src/services/email.service';
import { env } from '../src/config/env';

async function main() {
  console.log('\n--- DIAGNOSIS SMTP PAWANGTOOLS ---');
  console.log(`SMTP_HOST  : ${env.SMTP.HOST || '(KOSONG)'}`);
  console.log(`SMTP_PORT  : ${env.SMTP.PORT}`);
  console.log(`SMTP_SECURE: ${env.SMTP.SECURE}`);
  console.log(`SMTP_USER  : ${env.SMTP.USER || '(KOSONG)'}`);
  console.log(`SMTP_PASSWORD  : ${env.SMTP.PASSWORD ? '********' : '(KOSONG)'}`);
  console.log(`SMTP_FROM  : ${env.SMTP.FROM}`);
  console.log(`SMTP_ENABLED: ${env.SMTP.ENABLED}`);

  if (!env.SMTP.ENABLED) {
    console.error('\n❌ ERROR: Konfigurasi SMTP belum lengkap di backend/.env.');
    console.error('Pastikan SMTP_HOST, SMTP_USER, dan SMTP_PASS sudah diisi.');
    process.exit(1);
  }

  console.log('\n1. Memverifikasi koneksi ke server SMTP...');
  const verify = await emailService.verifyConnection();
  if (!verify.connected) {
    console.error(`\n❌ Gagal terhubung ke SMTP (${verify.reason}).`);
    console.error('Periksa kembali Host, Port, Username, atau Password SMTP Anda.');
    process.exit(1);
  }
  console.log('✅ Koneksi ke server SMTP berhasil diverifikasi!');

  const targetEmail = process.argv[2] || env.SMTP.USER;
  if (!targetEmail || !targetEmail.includes('@')) {
    console.log('\nTips: Jalankan `npm run test:smtp email-anda@domain.com` untuk mengirim email tes.');
    return;
  }

  console.log(`\n2. Mengirim email tes ke ${targetEmail}...`);
  const send = await emailService.send({
    to: targetEmail,
    subject: 'Tes Konfigurasi SMTP PawangTools',
    html: `
      <div style="font-family:sans-serif;padding:20px;border:1px solid #ccc;border-radius:8px">
        <h2>Koneksi SMTP Berhasil!</h2>
        <p>Email ini adalah pesan tes dari sistem PawangTools.</p>
        <p>Pengirim: <code>${env.SMTP.FROM}</code></p>
      </div>
    `,
  });

  if (send.delivered) {
    console.log(`\n🎉 SUKSES! Email tes berhasil dikirim ke ${targetEmail}.`);
  } else {
    console.error(`\n❌ Gagal mengirim email: ${send.reason}`);
    process.exit(1);
  }
}

main().catch(console.error);
