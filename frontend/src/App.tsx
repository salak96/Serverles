import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { useEffect } from 'react';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { SubscriptionsPage } from './pages/subscriptions/SubscriptionsPage';
import { LicensesPage } from './pages/licenses/LicensesPage';
import { DevicesPage } from './pages/devices/DevicesPage';
import { ToolsPage } from './pages/tools/ToolsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminLicensesPage } from './pages/admin/AdminLicensesPage';
import { AdminPlansPage } from './pages/admin/AdminPlansPage';
import { AdminToolsPage } from './pages/admin/AdminToolsPage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ActivityPage } from './pages/ActivityPage';
import { SecurityBreachPage } from './pages/SecurityBreachPage';
import { useSecurityBreachRouter } from './lib/useSecurityBreachRouter';

function Protected({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-ink-muted">
        <div className="skeleton h-8 w-32" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth/login" replace state={{ message: 'Sesi login tidak ditemukan atau telah berakhir. Silakan masuk kembali.' }} />;
  }
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function UserOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && user?.role === 'ADMIN') {
      window.location.replace('/dashboard');
    }
  }, [user, loading]);
  if (loading) return null;
  if (user?.role === 'ADMIN') return null;
  return <>{children}</>;
}

/**
 * Invisible component that mounts the security detector for the lifetime
 * of the route tree. It performs no rendering. It must be placed ABOVE
 * the <SecurityBreachPage /> route so that the detector is active on
 * every other page.
 */
function SecurityWatcher() {
  useSecurityBreachRouter();
  return null;
}

export function App() {
  return (
    <>
      <SecurityWatcher />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Auth */}
      <Route path="/auth/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/auth/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

      {/* App */}
      <Route element={<Protected><DashboardLayout /></Protected>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/subscriptions" element={<UserOnly><SubscriptionsPage /></UserOnly>} />
        <Route path="/licenses" element={<LicensesPage />} />
        <Route path="/licenses/:id" element={<LicensesPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/activity" element={<ActivityPage />} />

        <Route path="/admin" element={<Protected adminOnly><AdminDashboardPage /></Protected>} />
        <Route path="/admin/users" element={<Protected adminOnly><AdminUsersPage /></Protected>} />
        <Route path="/admin/licenses" element={<Protected adminOnly><AdminLicensesPage /></Protected>} />
        <Route path="/admin/plans" element={<Protected adminOnly><AdminPlansPage /></Protected>} />
        <Route path="/admin/tools" element={<Protected adminOnly><AdminToolsPage /></Protected>} />
        <Route path="/admin/notifications" element={<Protected adminOnly><AdminNotificationsPage /></Protected>} />
        <Route path="/admin/settings" element={<Protected adminOnly><AdminSettingsPage /></Protected>} />
        <Route path="/admin/audit" element={<Protected adminOnly><AdminAuditPage /></Protected>} />
        <Route path="/admin/orders" element={<Protected adminOnly><AdminOrdersPage /></Protected>} />
      </Route>

      <Route path="/security/breach" element={<SecurityBreachPage />} />
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
