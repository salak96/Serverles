import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Bell, CreditCard, Key, HardDrive, Package, Settings, Code2,
  LogOut, Menu, X, Activity, User, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatJakarta } from '@/lib/format';
import type { NotificationList } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const USER_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/notifications', label: 'Notifikasi', icon: Bell },
  { to: '/subscriptions', label: 'Langganan & Order', icon: CreditCard },
  { to: '/licenses', label: 'Lisensi & HWID', icon: Key },
  { to: '/devices', label: 'Perangkat', icon: HardDrive },
  { to: '/tools', label: 'Bot & Tools', icon: Package },
  { to: '/profile', label: 'Pengaturan Akun', icon: Settings },
  { to: '/activity', label: 'Log Aktivitas', icon: Activity },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/api-docs', label: 'Dokumentasi API', icon: Code2 },
  { to: '/admin/users', label: 'Admin Pengguna', icon: User },
  { to: '/admin/licenses', label: 'Admin Lisensi', icon: Key },
  { to: '/admin/orders', label: 'Admin Verifikasi Pembayaran', icon: CreditCard },
  { to: '/admin/plans', label: 'Admin Paket', icon: Package },
  { to: '/admin/tools', label: 'Admin Tools', icon: Package },
  { to: '/admin/notifications', label: 'Admin Notifikasi', icon: Bell },
  { to: '/admin/settings', label: 'Admin Pengaturan', icon: Settings },
  { to: '/admin/audit', label: 'Log Aktivitas', icon: Activity },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/notifications': 'Notifikasi',
  '/subscriptions': 'Langganan',
  '/licenses': 'Lisensi & HWID',
  '/devices': 'Perangkat',
  '/tools': 'Bot & Tools',
  '/api-docs': 'Dokumentasi API',
  '/profile': 'Pengaturan Akun',
  '/activity': 'Log Aktivitas',
  '/admin': 'Dashboard Admin',
  '/admin/users': 'Manajemen Pengguna',
  '/admin/licenses': 'Manajemen Lisensi',
  '/admin/orders': 'Verifikasi Pembayaran',
  '/admin/plans': 'Manajemen Paket',
  '/admin/tools': 'Manajemen Tools',
  '/admin/notifications': 'Manajemen Notifikasi',
  '/admin/settings': 'Pengaturan Sistem',
  '/admin/audit': 'Log Aktivitas Admin',
};

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Persistent sidebar collapsed state in localStorage
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pawang_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pawang_sidebar_collapsed', String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  const { data: notif } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<NotificationList>('/notifications', { query: { limit: 1 } }),
    refetchInterval: 60_000,
  });
  const unread = notif?.unread ?? 0;

  // Separate user and admin navigation items strictly
  const items = user?.role === 'ADMIN' ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
  const title = PAGE_TITLES[location.pathname] ?? 'PawangTools';

  const onLogout = async (): Promise<void> => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-[#0C0906] text-[#F5F5F5] font-sans selection:bg-[#FF8A00] selection:text-black">
      {/* =========================================================================
          DESKTOP SIDEBAR (EXPANDED & COLLAPSIBLE)
      ========================================================================== */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col bg-[#0D1118] border-r border-[#292D35] shrink-0 transition-all duration-300 ease-in-out relative z-30 select-none',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Brand Header & Collapse Toggle */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-[#292D35]">
          <div className={clsx('flex items-center gap-2.5 overflow-hidden', collapsed && 'justify-center w-full')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#FFA500] text-black flex items-center justify-center font-extrabold text-lg shrink-0 shadow-sm">
              P
            </div>
            {!collapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <div className="text-sm font-extrabold text-white tracking-tight leading-tight truncate">
                  Pawang Tools
                </div>
                <div className="text-[10px] font-medium text-[#A7B0C0] leading-tight truncate">
                  {user?.role === 'ADMIN' ? 'Portal Administrator' : 'Membership & License'}
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-lg text-[#A7B0C0] hover:text-white hover:bg-[#12151B] transition-colors"
              title="Perkecil menu sidebar"
              aria-label="Perkecil menu sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed expand button banner */}
        {collapsed && (
          <div className="py-2 flex justify-center border-b border-[#292D35]/50">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-lg text-[#A7B0C0] hover:text-[#FFA500] hover:bg-[#12151B] transition-colors"
              title="Perlebar menu sidebar"
              aria-label="Perlebar menu sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Item List */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1.5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/admin'}
              className={({ isActive }) =>
                clsx(
                  'group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200',
                  collapsed ? 'justify-center h-11 w-11 mx-auto' : 'px-3.5 py-2.5 gap-3',
                  isActive
                    ? 'bg-[#FF8A00]/15 text-[#FF8A00] font-semibold shadow-sm'
                    : 'text-[#A7B0C0] hover:text-white hover:bg-[#12151B]'
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />

              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.to === '/notifications' && unread > 0 && (
                    <Badge variant="accent">{unread > 9 ? '9+' : unread}</Badge>
                  )}
                </>
              )}

              {/* Tooltip on Collapsed Mode */}
              {collapsed && (
                <div className="pointer-events-none absolute left-full ml-3.5 z-50 px-3 py-1.5 rounded-lg bg-[#12151B] border border-[#292D35] text-xs font-semibold text-white shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {item.label}
                  {item.to === '/notifications' && unread > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#FF8A00] text-black text-[10px]">
                      {unread}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Profile & Logout Block */}
        <div className="border-t border-[#292D35] p-3">
          {!collapsed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF8A00]/20 to-[#FFA500]/10 border border-[#FF8A00]/30 text-[#FFA500] flex items-center justify-center text-sm font-bold shrink-0">
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
                  <div className="text-xs text-[#A7B0C0] truncate">{user?.email}</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[#A7B0C0] hover:text-white bg-[#12151B] hover:bg-[#1a1f29] border border-[#292D35] transition-colors"
                  onClick={() => navigate('/profile')}
                >
                  <Settings className="w-3.5 h-3.5" /> Akun
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-lg text-xs font-medium text-danger hover:text-white bg-[#12151B] hover:bg-danger/80 border border-[#292D35] transition-colors"
                  onClick={onLogout}
                  title="Keluar"
                  aria-label="Keluar"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="w-10 h-10 rounded-xl bg-[#12151B] border border-[#292D35] text-[#FFA500] hover:border-[#FF8A00] flex items-center justify-center text-sm font-bold transition-colors group relative"
                title={user?.name ?? 'Profil'}
              >
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
                <div className="pointer-events-none absolute left-full ml-3.5 z-50 px-2.5 py-1 rounded bg-[#12151B] border border-[#292D35] text-xs font-medium text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {user?.name}
                </div>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-lg text-danger hover:bg-danger/20 transition-colors group relative"
                title="Keluar"
                aria-label="Keluar"
              >
                <LogOut className="w-4 h-4" />
                <div className="pointer-events-none absolute left-full ml-3.5 z-50 px-2.5 py-1 rounded bg-[#12151B] border border-[#292D35] text-xs font-medium text-danger shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Keluar
                </div>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          MOBILE DRAWER SIDEBAR
      ========================================================================== */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#0D1118] border-r border-[#292D35] flex flex-col z-50 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b border-[#292D35]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF8A00] to-[#FFA500] text-black flex items-center justify-center font-bold text-base">
                  P
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white">Pawang Tools</div>
                  <div className="text-[10px] text-[#A7B0C0]">
                    {user?.role === 'ADMIN' ? 'Portal Administrator' : 'Membership Portal'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg text-[#A7B0C0] hover:text-white hover:bg-[#12151B]"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard' || item.to === '/admin'}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[#FF8A00]/15 text-[#FF8A00] font-semibold'
                        : 'text-[#A7B0C0] hover:text-white hover:bg-[#12151B]'
                    )
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.to === '/notifications' && unread > 0 && (
                    <Badge variant="accent">{unread > 9 ? '9+' : unread}</Badge>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-[#292D35] p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF8A00]/20 text-[#FFA500] flex items-center justify-center text-sm font-bold">
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{user?.name}</div>
                  <div className="text-xs text-[#A7B0C0] truncate">{user?.email}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#12151B] border border-[#292D35]"
                  onClick={() => { setDrawerOpen(false); navigate('/profile'); }}
                >
                  <Settings className="w-3.5 h-3.5" /> Akun
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-xl text-xs font-semibold text-danger bg-[#12151B] border border-[#292D35]"
                  onClick={onLogout}
                  aria-label="Keluar"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* =========================================================================
          MAIN CONTENT AREA
      ========================================================================== */}
      <div className="relative flex-1 flex flex-col min-w-0 bg-[#0C0906]">
        {/* Subtle Background Grid Pattern */}
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.035] z-0"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: '36px 36px',
          }}
          aria-hidden="true"
        />

        {/* Ambient Top Glow */}
        <div
          className="pointer-events-none fixed -top-40 right-1/4 w-[600px] h-[350px] bg-gradient-to-b from-[#D4AF37]/10 via-[#FF8A00]/5 to-transparent blur-3xl rounded-full z-0"
          aria-hidden="true"
        />

        {/* Top Header */}
        <header className="relative z-10 h-16 border-b border-[#292D35] bg-[#0D1118]/95 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 shrink-0">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-[#A7B0C0] hover:text-white hover:bg-[#12151B]"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base lg:text-lg font-bold text-white tracking-tight truncate">
              {title}
            </h1>
            <p className="text-xs text-[#A7B0C0] hidden sm:block">
              {formatJakarta(new Date())}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="p-2 rounded-xl text-[#A7B0C0] hover:text-white hover:bg-[#12151B] border border-transparent hover:border-[#292D35] relative transition-colors"
              aria-label="Notifikasi"
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF8A00] text-black text-[10px] flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF8A00]/20 to-[#FFA500]/10 border border-[#FF8A00]/30 text-[#FFA500] hover:border-[#FF8A00] flex items-center justify-center text-sm font-bold shadow-sm transition-all"
              aria-label="Profil Akun"
              title={user?.name ?? 'Profil Akun'}
            >
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </button>
          </div>
        </header>

        {/* Routed Page Content */}
        <main className="relative z-10 flex-1 overflow-y-auto px-4 lg:px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
