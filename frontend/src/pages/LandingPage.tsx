import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import {
  Shield,
  Zap,
  Users,
  CheckCircle2,
  Download,
  Key,
  ArrowRight,
  LogIn,
  UserPlus,
  Menu,
  X,
  MessageCircle,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';

export function LandingPage() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0906] text-white selection:bg-[#FF8A00] selection:text-black relative overflow-x-hidden font-sans">
      {/* Background Grid Pattern */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04] z-0"
        style={{
          backgroundImage: `linear-gradient(to right, #FF8A00 1px, transparent 1px), linear-gradient(to bottom, #FF8A00 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
        }}
        aria-hidden="true"
      />

      {/* Diagonal Corner Accents */}
      <div className="pointer-events-none fixed -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#FF8A00]/15 via-[#4A2B0D]/20 to-transparent blur-3xl rounded-full z-0" aria-hidden="true" />
      <div className="pointer-events-none fixed -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[#FFAA00]/10 via-[#4A2B0D]/20 to-transparent blur-3xl rounded-full z-0" aria-hidden="true" />

      {/* =========================================================================
          NAVBAR
      ========================================================================== */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0C0906]/90 border-b border-[#4A2B0D]/60 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo Brand */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A00] rounded-xl p-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#FFAA00] text-black flex items-center justify-center font-extrabold text-xl shadow-[0_0_20px_rgba(255,138,0,0.4)] group-hover:scale-105 transition-transform">
              P
            </div>
            <div className="text-left">
              <div className="text-lg font-extrabold tracking-tight text-white leading-tight">
                Pawang Tools
              </div>
              <div className="text-[11px] font-medium text-[#A7A7A7] leading-tight tracking-wide">
                Membership &amp; License Portal
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#A7A7A7]">
            <button
              type="button"
              onClick={() => scrollToSection('keunggulan')}
              className="hover:text-[#FFAA00] transition-colors focus:outline-none focus-visible:text-[#FFAA00]"
            >
              Keunggulan
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('cara-kerja')}
              className="hover:text-[#FFAA00] transition-colors focus:outline-none focus-visible:text-[#FFAA00]"
            >
              Cara kerja
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('dukungan')}
              className="hover:text-[#FFAA00] transition-colors focus:outline-none focus-visible:text-[#FFAA00]"
            >
              Dukungan
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('komunitas')}
              className="hover:text-[#FFAA00] transition-colors focus:outline-none focus-visible:text-[#FFAA00]"
            >
              Komunitas
            </button>
          </nav>

          {/* Desktop Auth CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-[#FF8A00] to-[#FFAA00] hover:from-[#FFAA00] hover:to-[#FF8A00] shadow-[0_4px_20px_rgba(255,138,0,0.35)] hover:shadow-[0_6px_25px_rgba(255,138,0,0.5)] transition-all active:scale-[0.98]"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Buka Dashboard</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#FF8A00] border border-[#FF8A00] hover:bg-[#FF8A00]/10 hover:border-[#FFAA00] hover:text-[#FFAA00] transition-all active:scale-[0.98]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk</span>
                </Link>
                <Link
                  to="/auth/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-[#FF8A00] to-[#FFAA00] hover:from-[#FFAA00] hover:to-[#FF8A00] shadow-[0_4px_20px_rgba(255,138,0,0.35)] hover:shadow-[0_6px_25px_rgba(255,138,0,0.5)] transition-all active:scale-[0.98]"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Daftar</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Hamburger Toggle */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl border border-[#4A2B0D] bg-[#17110B] text-white hover:text-[#FF8A00] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#17110B] border-b border-[#4A2B0D] px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-2">
            <nav className="flex flex-col space-y-2 text-sm font-medium text-[#A7A7A7]">
              <button
                type="button"
                onClick={() => scrollToSection('keunggulan')}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#0C0906] hover:text-[#FFAA00] transition-colors"
              >
                Keunggulan
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('cara-kerja')}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#0C0906] hover:text-[#FFAA00] transition-colors"
              >
                Cara kerja
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('dukungan')}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#0C0906] hover:text-[#FFAA00] transition-colors"
              >
                Dukungan
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('komunitas')}
                className="text-left px-3 py-2 rounded-lg hover:bg-[#0C0906] hover:text-[#FFAA00] transition-colors"
              >
                Komunitas
              </button>
            </nav>
            <div className="pt-2 border-t border-[#4A2B0D]/60 flex flex-col gap-2">
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-[#FF8A00] to-[#FFAA00]"
                >
                  <LayoutDashboard className="w-4 h-4" /> Buka Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#FF8A00] border border-[#FF8A00] hover:bg-[#FF8A00]/10"
                  >
                    <LogIn className="w-4 h-4" /> Masuk
                  </Link>
                  <Link
                    to="/auth/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-[#FF8A00] to-[#FFAA00]"
                  >
                    <UserPlus className="w-4 h-4" /> Daftar Sekarang
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          HERO SECTION (TWO COLUMNS)
      ========================================================================== */}
      <section className="relative z-10 pt-12 pb-20 md:pt-20 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: Main Pitch & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Small Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#4A2B0D] bg-[#17110B]/90 text-[#FFAA00] text-xs font-semibold tracking-wider uppercase shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#FF8A00]" />
              <span>PORTAL MEMBERSHIP &amp; LISENSI TOOLS</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              Solusi Tools Terbaik.
              <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-[#FF8A00] via-[#FFAA00] to-[#FF8A00] bg-clip-text text-transparent">
                Untuk Produktivitas Anda.
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-[#A7A7A7] max-w-2xl leading-relaxed">
              Dapatkan akses ke berbagai tools premium, lisensi resmi, dan dukungan penuh untuk mendukung kebutuhan digital Anda setiap hari.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                to={user ? '/dashboard' : '/auth/register'}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-base text-black bg-gradient-to-r from-[#FF8A00] to-[#FFAA00] hover:from-[#FFAA00] hover:to-[#FF8A00] shadow-[0_6px_25px_rgba(255,138,0,0.4)] hover:shadow-[0_8px_30px_rgba(255,138,0,0.55)] active:scale-[0.98] transition-all"
              >
                <span>{user ? 'Buka Dashboard' : 'Buat akun gratis'}</span>
                <ArrowRight className="w-5 h-5 text-black" strokeWidth={2.4} />
              </Link>
              <Link
                to={user ? '/dashboard' : '/auth/login'}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-base text-white border border-[#4A2B0D] bg-[#17110B]/80 hover:border-[#FF8A00] hover:text-[#FFAA00] hover:bg-[#17110B] active:scale-[0.98] transition-all"
              >
                <LogIn className="w-5 h-5 text-[#FF8A00]" />
                <span>{user ? 'Masuk ke dashboard' : 'Masuk ke portal'}</span>
              </Link>
            </div>

            {/* Three Value Checklist */}
            <div className="pt-4 flex flex-wrap items-center gap-y-3 gap-x-6 text-sm text-[#A7A7A7]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" strokeWidth={2.5} />
                <span>Aktivasi cepat</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" strokeWidth={2.5} />
                <span>Update terbaru</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" strokeWidth={2.5} />
                <span>Dukungan komunitas</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Modern Dashboard UI Mockup Panel */}
          <div className="lg:col-span-5 relative flex justify-center">
            {/* Visual Depth Glow Behind Panel */}
            <div className="absolute -inset-4 sm:-inset-8 rounded-full bg-gradient-to-tr from-[#FF8A00]/25 via-[#4A2B0D]/30 to-transparent blur-3xl -z-10" aria-hidden="true" />
            
            {/* Decorative Dot Matrix Accent */}
            <div
              className="pointer-events-none absolute -bottom-6 -right-6 w-32 h-32 opacity-25 -z-10"
              style={{
                backgroundImage: `radial-gradient(circle, #FFAA00 1.5px, transparent 1.5px)`,
                backgroundSize: '16px 16px',
              }}
              aria-hidden="true"
            />

            {/* Mockup Frame Container */}
            <div className="w-full max-w-[460px] bg-[#17110B]/95 backdrop-blur-md border border-[#4A2B0D] rounded-2xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(255,138,0,0.12)] space-y-4 text-left">
              
              {/* Window Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#4A2B0D]/70">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-[#4A2B0D] bg-[#0C0906] text-[10px] font-bold text-[#FFAA00] uppercase tracking-wider">
                  <Shield className="w-3 h-3 text-[#FF8A00]" />
                  <span>PORTAL ADMIN</span>
                </div>
              </div>

              {/* Panel Heading */}
              <div className="pt-1">
                <span className="text-[11px] font-bold text-[#FF8A00] uppercase tracking-wider block mb-1">
                  SELAMAT DATANG
                </span>
                <h2 className="text-xl font-extrabold text-white">
                  Masuk ke Pawang Tools
                </h2>
              </div>

              {/* Info Card 1: Login Placeholder */}
              <div className="bg-[#0C0906] border border-[#4A2B0D]/80 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Login — Akun Anda</span>
                  <span className="text-[10px] text-[#A7A7A7]">Tervalidasi</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#17110B] border border-[#4A2B0D]/50 text-xs text-[#A7A7A7] font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span>user@pawangtools.id</span>
                </div>
              </div>

              {/* Info Card 2: Password Placeholder */}
              <div className="bg-[#0C0906] border border-[#4A2B0D]/80 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Password — Kata Sandi</span>
                  <span className="text-[10px] text-[#A7A7A7]">Terenkripsi</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#17110B] border border-[#4A2B0D]/50 text-xs text-[#A7A7A7] font-mono tracking-widest">
                  <span>••••••••••••</span>
                  <Key className="w-3.5 h-3.5 text-[#FF8A00]" />
                </div>
              </div>

              {/* Update Status Card */}
              <div className="bg-gradient-to-r from-[#17110B] to-[#0C0906] border border-[#4A2B0D] rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#FF8A00]/15 border border-[#FF8A00]/30 text-[#FF8A00] flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">Siap diunduh</div>
                    <div className="text-[11px] text-[#A7A7A7] truncate">Dukungan admin &amp; komunitas tersedia</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 uppercase shrink-0">
                  STABLE
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION: KEUNGGULAN (#keunggulan)
      ========================================================================== */}
      <section id="keunggulan" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#4A2B0D]/50">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#4A2B0D] bg-[#17110B] text-[#FFAA00] text-xs font-semibold tracking-wider uppercase">
            <span>KEUNGGULAN UTAMA</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Fitur Kelas Enterprise untuk Pengguna &amp; Komunitas
          </h2>
          <p className="text-[#A7A7A7] text-sm sm:text-base leading-relaxed">
            Semua modul dirancang terpadu dengan arsitektur proteksi hardware dan kemudahan aktivasi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Feature 1 */}
          <div className="bg-[#17110B]/80 border border-[#4A2B0D] rounded-2xl p-6 text-left space-y-3 hover:border-[#FF8A00]/50 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#FF8A00]/15 border border-[#FF8A00]/30 text-[#FF8A00] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#FFAA00] transition-colors">
              Proteksi HWID 1 PC
            </h3>
            <p className="text-sm text-[#A7A7A7] leading-relaxed">
              Lisensi terikat aman ke identitas perangkat Anda untuk mencegah duplikasi ilegal dan menjaga stabilitas akun.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-[#17110B]/80 border border-[#4A2B0D] rounded-2xl p-6 text-left space-y-3 hover:border-[#FF8A00]/50 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#FF8A00]/15 border border-[#FF8A00]/30 text-[#FF8A00] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#FFAA00] transition-colors">
              Aktivasi Cepat &amp; Otomatis
            </h3>
            <p className="text-sm text-[#A7A7A7] leading-relaxed">
              Dukungan pembayaran QRIS instan dan penerbitan kunci lisensi tanpa perlu menunggu proses berjam-jam.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-[#17110B]/80 border border-[#4A2B0D] rounded-2xl p-6 text-left space-y-3 hover:border-[#FF8A00]/50 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#FF8A00]/15 border border-[#FF8A00]/30 text-[#FF8A00] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#FFAA00] transition-colors">
              Katalog Bot &amp; Script
            </h3>
            <p className="text-sm text-[#A7A7A7] leading-relaxed">
              Akses download langsung ke rilis software, tool otomasi, dan update berkala dari admin berpengalaman.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-[#17110B]/80 border border-[#4A2B0D] rounded-2xl p-6 text-left space-y-3 hover:border-[#FF8A00]/50 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#FF8A00]/15 border border-[#FF8A00]/30 text-[#FF8A00] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#FFAA00] transition-colors">
              Dukungan Penuh &amp; Grup
            </h3>
            <p className="text-sm text-[#A7A7A7] leading-relaxed">
              Bantuan setup personal dari tim kami serta ruang berbagi pengalaman bersama sesama pengguna tools.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: CARA KERJA (#cara-kerja)
      ========================================================================== */}
      <section id="cara-kerja" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#4A2B0D]/50">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#4A2B0D] bg-[#17110B] text-[#FFAA00] text-xs font-semibold tracking-wider uppercase">
            <span>ALUR MUDAH</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            3 Langkah Mudah Memulai
          </h2>
          <p className="text-[#A7A7A7] text-sm sm:text-base leading-relaxed">
            Tidak perlu konfigurasi rumit. Mulai dalam beberapa menit langsung dari browser Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left relative">
          {/* Step 1 */}
          <div className="bg-[#17110B]/90 border border-[#4A2B0D] rounded-2xl p-7 relative space-y-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#FFAA00] text-black font-extrabold text-xl flex items-center justify-center shadow-md">
              1
            </div>
            <h3 className="text-xl font-bold text-white">Daftar Akun Gratis</h3>
            <p className="text-sm text-[#A7A7A7] leading-relaxed">
              Buat akun di portal Pawang Tools menggunakan email Anda. Selesaikan verifikasi email untuk mengamankan akun Anda.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#17110B]/90 border border-[#4A2B0D] rounded-2xl p-7 relative space-y-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#FFAA00] text-black font-extrabold text-xl flex items-center justify-center shadow-md">
              2
            </div>
            <h3 className="text-xl font-bold text-white">Pilih Paket Lisensi</h3>
            <p className="text-sm text-[#A7A7A7] leading-relaxed">
              Pilih paket langganan sesuai kebutuhan (Free, Basic, Pro, atau Custom) dan dapatkan Kunci Lisensi resmi instan.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#17110B]/90 border border-[#4A2B0D] rounded-2xl p-7 relative space-y-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#FFAA00] text-black font-extrabold text-xl flex items-center justify-center shadow-md">
              3
            </div>
            <h3 className="text-xl font-bold text-white">Aktivasi di Desktop</h3>
            <p className="text-sm text-[#A7A7A7] leading-relaxed">
              Buka aplikasi desktop pilihan Anda, tempelkan License Key, dan perangkat Anda akan langsung terikat serta siap digunakan.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: DUKUNGAN (#dukungan) & KOMUNITAS (#komunitas)
      ========================================================================== */}
      <section id="dukungan" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#4A2B0D]/50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
          {/* Dukungan Card */}
          <div className="bg-[#17110B]/95 border border-[#4A2B0D] rounded-3xl p-8 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-[#FF8A00]/15 border border-[#FF8A00]/30 text-[#FF8A00] flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Dukungan Pengguna Cepat</h3>
              <p className="text-sm text-[#A7A7A7] leading-relaxed">
                Kendala aktivasi, instalasi script, atau pergantian perangkat? Tim support siap membantu Anda secara langsung via WhatsApp atau tiket portal.
              </p>
            </div>
            <div className="pt-2">
              <a
                href="https://wa.me/6285867336036"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm text-black bg-[#22C55E] hover:bg-[#16A34A] transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Hubungi Admin via WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Komunitas Card */}
          <div id="komunitas" className="bg-[#17110B]/95 border border-[#4A2B0D] rounded-3xl p-8 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-[#FFAA00]/15 border border-[#FFAA00]/30 text-[#FFAA00] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Komunitas Pawang Tools</h3>
              <p className="text-sm text-[#A7A7A7] leading-relaxed">
                Bergabung dengan komunitas sesama pengguna tools otomasi. Dapatkan informasi rilis terbaru, diskusi teknik, dan tips penggunaan tools langsung dari member.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/auth/register"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm text-white border border-[#4A2B0D] hover:border-[#FF8A00] hover:text-[#FFAA00] transition-colors"
              >
                <UserPlus className="w-4 h-4 text-[#FF8A00]" />
                <span>Gabung Bersama Komunitas</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CTA BANNER BEFORE FOOTER
      ========================================================================== */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl border border-[#4A2B0D] bg-gradient-to-r from-[#17110B] via-[#21160E] to-[#17110B] p-8 sm:p-12 text-center space-y-6 relative overflow-hidden shadow-2xl">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Siap Meningkatkan Produktivitas Anda?
            </h2>
            <p className="text-[#A7A7A7] text-sm sm:text-base leading-relaxed">
              Daftar sekarang dan nikmati keleluasaan akses tools otomasi terlengkap dengan proteksi lisensi resmi.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              to="/auth/register"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl text-base font-bold text-black bg-gradient-to-r from-[#FF8A00] to-[#FFAA00] hover:from-[#FFAA00] hover:to-[#FF8A00] shadow-lg transition-all"
            >
              <UserPlus className="w-5 h-5" />
              <span>Daftar Akun Sekarang</span>
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER
      ========================================================================== */}
      <footer className="relative z-10 border-t border-[#4A2B0D] bg-[#0C0906] py-10 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-center justify-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF8A00] text-black font-extrabold text-sm flex items-center justify-center">
              P
            </div>
            <span className="font-extrabold text-white text-base">Pawang Tools</span>
          </div>
          <p className="text-xs sm:text-sm text-[#A7A7A7]">
            &copy; 2026 <span className="text-[#FF8A00] font-semibold">Android Store</span>. Seluruh hak cipta dilindungi.
          </p>
        </div>
      </footer>
    </div>
  );
}
