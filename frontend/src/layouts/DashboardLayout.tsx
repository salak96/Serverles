import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Bell, CreditCard, Key, HardDrive, Package, Settings, Code2,
  LogOut, Shield, Menu, X, HelpCircle, Activity, User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatJakarta } from '@/lib/format';
import type { NotificationList } from '@/types';

interface NavItem { to: string; label: string; icon: React.ComponentType<{ className?: string }>; admin?: boolean; userOnly?: boolean }

const ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/notifications', label: 'Notifikasi', icon: Bell },
  { to: '/subscriptions', label: 'Langganan & Order', icon: CreditCard, userOnly: true },
  { to: '/licenses', label: 'Lisensi & HWID', icon: Key, userOnly: true },
  { to: '/devices', label: 'Perangkat', icon: HardDrive },
  { to: '/tools', label: 'Bot & Tools', icon: Package },
  { to: '/api-docs', label: 'Dokumentasi API', icon: Code2, admin: true },
  { to: '/profile', label: 'Pengaturan Akun', icon: Settings },
  { to: '/admin', label: 'Admin Dashboard', icon: Shield, admin: true },
  { to: '/admin/users', label: 'Admin · Pengguna', icon: User, admin: true },
  { to: '/admin/licenses', label: 'Admin · Lisensi', icon: Key, admin: true },
  { to: '/admin/orders', label: 'Admin · Verifikasi Pembayaran', icon: CreditCard, admin: true },
  { to: '/admin/plans', label: 'Admin · Paket', icon: CreditCard, admin: true },
  { to: '/admin/tools', label: 'Admin · Tools', icon: Package, admin: true },
  { to: '/admin/notifications', label: 'Admin · Notifikasi', icon: Bell, admin: true },
  { to: '/admin/settings', label: 'Admin · Pengaturan', icon: Settings, admin: true },
  { to: '/activity', label: 'Log Aktivitas', icon: Activity },
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
  '/admin': 'Admin Dashboard',
  '/admin/users': 'Manajemen Pengguna',
  '/admin/licenses': 'Manajemen Lisensi',
  '/admin/orders': 'Verifikasi Pembayaran',
  '/admin/plans': 'Manajemen Paket',
  '/admin/tools': 'Manajemen Tools',
  '/admin/notifications': 'Manajemen Notifikasi',
  '/admin/settings': 'Pengaturan Sistem',
};

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: notif } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<NotificationList>('/notifications', { query: { limit: 1 } }),
    refetchInterval: 60_000,
  });
  const unread = notif?.unread ?? 0;

  const items = ITEMS.filter((i) => {
    if (i.admin && user?.role !== 'ADMIN') return false;
    if (i.userOnly && user?.role === 'ADMIN') return false;
    return true;
  });
  const title = PAGE_TITLES[location.pathname] ?? 'PawangTools';

  const onLogout = async (): Promise<void> => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-bg text-ink">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-bg-sidebar border-r border-line shrink-0">
        <Brand />
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/admin'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:text-ink hover:bg-bg-card',
              )}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              {item.to === '/notifications' && unread > 0 && (
                <Badge variant="accent">{unread}</Badge>
              )}
              {item.admin && <Badge variant="muted">admin</Badge>}
            </NavLink>
          ))}
        </nav>
        <UserBlock onLogout={onLogout} />
      </aside>

      {/* Sidebar - mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-bg-sidebar border-r border-line flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-line">
              <Brand />
              <button className="btn btn-ghost p-2" onClick={() => setDrawerOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard' || item.to === '/admin'}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                    isActive ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:text-ink hover:bg-bg-card',
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <UserBlock onLogout={onLogout} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="relative flex-1 flex flex-col min-w-0 bg-[#0B0B0B]">
        {/* Subtle modern background grid pattern */}
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: '36px 36px',
          }}
          aria-hidden="true"
        />

        {/* Decorative ambient radial glow */}
        <div
          className="pointer-events-none fixed -top-40 right-1/4 w-[600px] h-[350px] bg-gradient-to-b from-[#D4AF37]/10 via-[#FF8A00]/5 to-transparent blur-3xl rounded-full"
          aria-hidden="true"
        />

        <header className="relative z-10 h-16 border-b border-line bg-bg-sidebar/95 backdrop-blur-sm flex items-center px-4 lg:px-6 gap-4 shrink-0">
          <button className="lg:hidden btn btn-ghost p-2" onClick={() => setDrawerOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base lg:text-lg font-semibold truncate">{title}</h1>
            <p className="text-xs text-ink-muted hidden sm:block">
              {formatJakarta(new Date())}
            </p>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className="btn btn-ghost p-2 relative"
            aria-label="Notifikasi"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-bg text-[10px] flex items-center justify-center font-semibold">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-semibold" aria-label="Profil">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </button>
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto px-4 lg:px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="h-16 flex items-center gap-2 px-4 border-b border-line">
      <div className="w-8 h-8 rounded-md bg-accent text-bg flex items-center justify-center font-bold">P</div>
      <div>
        <div className="text-sm font-semibold leading-tight">PawangTools</div>
        <div className="text-[10px] text-ink-muted leading-tight">Membership & License</div>
      </div>
    </div>
  );
}

function UserBlock({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  return (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-semibold">
          {user?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{user?.name}</div>
          <div className="text-xs text-ink-muted truncate">{user?.email}</div>
        </div>
      </div>
      <div className="flex gap-1">
        <button className="btn btn-ghost flex-1 justify-start text-xs" onClick={() => window.location.assign('/profile')}>
          <Settings className="w-3.5 h-3.5" /> Pengaturan
        </button>
        <button className="btn btn-ghost text-xs" onClick={onLogout} aria-label="Keluar">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

void HelpCircle;
