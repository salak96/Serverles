import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, HttpError, setAccessToken } from './api';
import type { MeResponse } from '@/types';

interface AuthState {
  user: MeResponse | null;
  loading: boolean;
  setUser: (u: MeResponse | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async (): Promise<void> => {
    try {
      const u = await api<MeResponse>('/auth/me');
      setUser(u);
    } catch (e) {
      if (e instanceof HttpError && (e.status === 401 || e.status === 403)) {
        setUser(null);
      } else {
        // network error — keep previous state
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
  };

  useEffect(() => { void refresh(); }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, setUser, refresh, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
