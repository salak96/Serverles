export const termsOfServiceContent = (
  <>
    <p className="text-ink">Terima kasih telah menggunakan PawangTools. Dengan mendaftar dan menggunakan layanan PawangTools, Anda menyetujui ketentuan berikut.</p>

    <h3 className="text-ink font-semibold pt-2">1. Definisi</h3>
    <p><strong className="text-ink">PawangTools</strong> adalah portal membership dan server lisensi HWID yang menyediakan layanan pengelolaan pengguna, langganan, API key lisensi, perangkat, bot, tools, notifikasi, dan distribusi file.</p>
    <p><strong className="text-ink">Pengguna</strong> adalah individu yang mendaftar dan menggunakan layanan PawangTools.</p>
    <p><strong className="text-ink">Lisensi</strong> adalah hak pakai terbatas yang diberikan kepada Pengguna sesuai paket berlangganan yang dipilih.</p>

    <h3 className="text-ink font-semibold pt-2">2. Pendaftaran Akun</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Anda wajib memberikan informasi yang akurat dan lengkap saat pendaftaran.</li>
      <li>Anda bertanggung jawab atas keamanan kata sandi dan aktivitas pada akun Anda.</li>
      <li>Satu email hanya dapat digunakan untuk satu akun PawangTools.</li>
      <li>Verifikasi email wajib diselesaikan untuk mengaktifkan sebagian besar fitur.</li>
    </ul>

    <h3 className="text-ink font-semibold pt-2">3. Paket Berlangganan</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Harga, durasi, dan fitur paket ditentukan oleh administrator dan dapat berubah sewaktu-waktu.</li>
      <li>Lisensi hanya berlaku selama periode aktif dan akan otomatis non-aktif setelah masa aktif berakhir.</li>
      <li>Pengguna dapat memperpanjang atau mengganti paket melalui halaman Langganan.</li>
      <li>Pemrosesan pembayaran tunduk pada kebijakan payment gateway yang digunakan.</li>
    </ul>

    <h3 className="text-ink font-semibold pt-2">4. Lisensi dan API Key</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>API key lisensi bersifat rahasia dan tidak boleh dibagikan kepada pihak lain.</li>
      <li>PawangTools dapat melakukan rotasi API key untuk alasan keamanan; key lama akan dicabut permanen.</li>
      <li>Penggunaan API key di luar ketentuan paket yang dibeli adalah pelanggaran.</li>
      <li>HWID yang terikat pada lisensi tunduk pada kuota dan cooldown sesuai paket.</li>
    </ul>

    <h3 className="text-ink font-semibold pt-2">5. Pembatasan Penggunaan</h3>
    <p>Anda tidak diperkenankan untuk:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Menggunakan layanan untuk aktivitas yang melanggar hukum.</li>
      <li>Mencoba mengakses data Pengguna lain atau sistem tanpa izin.</li>
      <li>Melakukan reverse engineering, dekompilasi, atau modifikasi layanan untuk规避 mekanisme lisensi.</li>
      <li>Menyebarkan malware, virus, atau konten berbahaya melalui layanan.</li>
      <li>Menggunakan akun untuk aktivitas yang merugikan Pengguna lain atau PawangTools.</li>
    </ul>

    <h3 className="text-ink font-semibold pt-2">6. Penangguhan dan Pengakhiran</h3>
    <p>PawangTools berhak menangguhkan atau mengakhiri akun Pengguna yang melanggar ketentuan ini, tanpa kewajiban pengembalian dana. Pengguna dapat mengajukan banding melalui kontak dukungan yang tersedia.</p>

    <h3 className="text-ink font-semibold pt-2">7. Perubahan Layanan</h3>
    <p>PawangTools dapat mengubah, menambahkan, atau menghentikan fitur sewaktu-waktu dengan pemberitahuan sewajarnya. Versi ketentuan ini akan diperbarui dan Pengguna diharapkan meninjau secara berkala.</p>

    <h3 className="text-ink font-semibold pt-2">8. Penafian</h3>
    <p>Layanan disediakan &quot;sebagaimana adanya&quot; (<em>as is</em>). PawangTools tidak menjamin bahwa layanan akan selalu tersedia tanpa gangguan. Sejauh diizinkan oleh hukum, PawangTools tidak bertanggung jawab atas kerugian tidak langsung yang timbul dari penggunaan layanan.</p>

    <h3 className="text-ink font-semibold pt-2">9. Hukum yang Berlaku</h3>
    <p>Ketentuan ini tunduk pada hukum Republik Indonesia. Setiap sengketa akan diselesaikan melalui musyawarah, dan apabila gagal, akan diselesaikan di pengadilan yang berwenang di Indonesia.</p>

    <p className="text-xs text-ink-muted pt-4 border-t border-line">Terakhir diperbarui: 16 Oktober 2026.</p>
  </>
);

export const privacyPolicyContent = (
  <>
    <p className="text-ink">Kebijakan Privasi ini menjelaskan bagaimana PawangTools mengumpulkan, menggunakan, dan melindungi informasi pribadi Anda.</p>

    <h3 className="text-ink font-semibold pt-2">1. Informasi yang Kami Kumpulkan</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li><strong className="text-ink">Informasi akun</strong>: nama lengkap, email, dan kata sandi (disimpan dalam bentuk hash Argon2id, tidak pernah plaintext).</li>
      <li><strong className="text-ink">Informasi langganan</strong>: paket yang dipilih, status pembayaran, dan masa aktif.</li>
      <li><strong className="text-ink">Informasi lisensi</strong>: API key (disimpan sebagai hash SHA-256), perangkat terikat (disimpan sebagai HMAC-SHA-256 dari HWID, bukan HWID mentah).</li>
      <li><strong className="text-ink">Log aktivitas</strong>: waktu, alamat IP, dan jenis aktivitas untuk keamanan dan audit.</li>
      <li><strong className="text-ink">Data perangkat</strong>: nama, platform, dan versi aplikasi yang Anda daftarkan.</li>
    </ul>

    <h3 className="text-ink font-semibold pt-2">2. Penggunaan Informasi</h3>
    <p>Informasi yang dikumpulkan digunakan untuk:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Menyediakan dan mengelola akun, langganan, dan lisensi Anda.</li>
      <li>Mengirimkan email verifikasi, reset kata sandi, dan notifikasi terkait layanan.</li>
      <li>Memvalidasi lisensi pada aplikasi eksternal (desktop, bot, script).</li>
      <li>Mendeteksi dan mencegah penyalahgunaan layanan.</li>
      <li>Memenuhi kewajiban hukum yang berlaku.</li>
    </ul>

    <h3 className="text-ink font-semibold pt-2">3. Penyimpanan dan Keamanan</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Data disimpan pada server MySQL 8 dengan akses terbatas.</li>
      <li>Password di-hash menggunakan Argon2id; API key di-hash menggunakan SHA-256; HWID di-hash menggunakan HMAC-SHA-256.</li>
      <li>Komunikasi dilakukan melalui HTTPS pada produksi.</li>
      <li>Log secara otomatis menyamarkan (<em>redact</em>) informasi sensitif seperti password, token, dan API key.</li>
    </ul>

    <h3 className="text-ink font-semibold pt-2">4. Pembagian Informasi</h3>
    <p>PawangTools tidak menjual atau membagikan informasi pribadi Anda kepada pihak ketiga, kecuali:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Diperlukan oleh payment gateway untuk memproses transaksi (nama dan email saja).</li>
      <li>Diperlukan oleh penyedia SMTP untuk mengirim email (alamat email saja).</li>
      <li>Diwajibkan oleh hukum atau otoritas yang berwenang.</li>
    </ul>

    <h3 className="text-ink font-semibold pt-2">5. Penyimpanan Email (SMTP)</h3>
    <p>Jika administrator mengaktifkan SMTP, email yang kami kirim (verifikasi, reset, notifikasi) dapat disimpan pada server SMTP penyedia. Penyimpanan tersebut tunduk pada kebijakan privasi penyedia SMTP yang digunakan.</p>

    <h3 className="text-ink font-semibold pt-2">6. Hak Pengguna</h3>
    <p>Anda berhak untuk:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>Meminta salinan data pribadi Anda yang kami simpan.</li>
      <li>Meminta perbaikan data yang tidak akurat.</li>
      <li>Meminta penghapusan akun dan data terkait (dengan pengecualian data yang wajib disimpan untuk kepatuhan hukum).</li>
      <li>Menarik kembali persetujuan terhadap pemrosesan data tertentu.</li>
    </ul>
    <p>Permintaan dapat diajukan melalui halaman Pengaturan Akun atau kontak dukungan.</p>

    <h3 className="text-ink font-semibold pt-2">7. Retensi Data</h3>
    <ul className="list-disc pl-5 space-y-1">
      <li>Data akun: selama akun aktif, dan hingga 30 hari setelah permintaan penghapusan (untuk pemulihan).</li>
      <li>Audit log: hingga 90 hari.</li>
      <li>Catatan aktivasi lisensi: hingga 60 hari.</li>
      <li>Backup database: hingga 14 hari pada disk lokal.</li>
    </ul>

    <h3 className="text-ink font-semibold pt-2">8. Cookies</h3>
    <p>PawangTools menggunakan cookie HttpOnly untuk menyimpan access token dan refresh token. Cookie tersebut tidak dapat diakses oleh JavaScript dan digunakan hanya untuk autentikasi. Tidak ada cookie pelacakan pihak ketiga.</p>

    <h3 className="text-ink font-semibold pt-2">9. Perubahan Kebijakan</h3>
    <p>Kebijakan ini dapat diperbarui sewaktu-waktu. Versi terbaru akan selalu tersedia di halaman ini. Perubahan material akan diinformasikan melalui notifikasi pada dashboard.</p>

    <h3 className="text-ink font-semibold pt-2">10. Kontak</h3>
    <p>Pertanyaan mengenai privasi dapat ditujukan kepada administrator melalui halaman Bantuan pada dashboard.</p>

    <p className="text-xs text-ink-muted pt-4 border-t border-line">Terakhir diperbarui: 16 Oktober 2026.</p>
  </>
);
