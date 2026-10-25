import { env } from '../src/config/env';

async function main() {
  console.log('\n--- DIAGNOSIS BOT TELEGRAM PAWANGTOOLS ---');
  const token = env.TELEGRAM.BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM.CHAT_ID?.trim();

  console.log(`TELEGRAM_BOT_TOKEN: ${token ? `${token.slice(0, 8)}...${token.slice(-4)}` : '(KOSONG / BELUM DIISI)'}`);
  console.log(`TELEGRAM_CHAT_ID  : ${chatId || '(KOSONG / BELUM DIISI)'}`);

  if (!token) {
    console.error('\n❌ ERROR: TELEGRAM_BOT_TOKEN belum diisi di backend/.env.');
    console.error('Silakan buat bot melalui @BotFather di Telegram lalu masukkan tokennya.');
    process.exit(1);
  }

  if (!chatId) {
    console.error('\n❌ ERROR: TELEGRAM_CHAT_ID belum diisi di backend/.env.');
    console.error('Kirim pesan ke bot Anda, lalu dapatkan ID Anda via @userinfobot atau @getmyid_bot.');
    process.exit(1);
  }

  console.log('\n1. Menguji koneksi ke Bot API...');
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = await meRes.json() as { ok: boolean; result?: { username: string; first_name: string }; description?: string };
    if (!me.ok) {
      console.error(`\n❌ Token bot tidak valid! Pesan Telegram: ${me.description}`);
      process.exit(1);
    }
    console.log(`✅ Bot terdeteksi: ${me.result?.first_name} (@${me.result?.username})`);
  } catch (err) {
    console.error('\n❌ Gagal menghubungi server Telegram. Periksa koneksi internet server:', err);
    process.exit(1);
  }

  console.log(`\n2. Mengirim pesan tes ke chat ID: ${chatId}...`);
  try {
    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🔔 *Tes Koneksi PawangTools Berhasil!*\n\nBot Telegram Anda sudah terhubung ke server dan siap menerima notifikasi order serta keamanan lisensi.',
        parse_mode: 'Markdown',
      }),
    });

    const sendData = await sendRes.json() as { ok: boolean; description?: string; error_code?: number };
    if (!sendData.ok) {
      console.error(`\n❌ Gagal mengirim pesan ke Chat ID ${chatId}!`);
      console.error(`Kode Error : ${sendData.error_code}`);
      console.error(`Keterangan : ${sendData.description}`);
      console.log('\n💡 TIPS PERBAIKAN:');
      if (sendData.description?.includes('chat not found')) {
        console.log('- Anda BELUM menekan tombol "/start" di bot tersebut.');
        console.log('- Buka bot Anda di Telegram dan ketik /start agar bot diizinkan mengirim pesan ke Anda.');
        console.log('- Jika ini adalah Grup / Channel, pastikan Bot sudah di-Invite dan dijadikan Administrator.');
      } else if (sendData.description?.includes('bot was blocked')) {
        console.log('- Anda memblokir bot ini. Silakan unblock bot di Telegram.');
      }
      process.exit(1);
    }

    console.log('\n🎉 SUKSES! Pesan tes telah masuk ke Telegram Anda.');
  } catch (err) {
    console.error('\n❌ Gagal mengirim pesan:', err);
    process.exit(1);
  }
}

main().catch(console.error);
