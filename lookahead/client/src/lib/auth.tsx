import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, devUser, getSupabase } from './api';

export interface Me {
  user: { id: string; name: string; email: string };
  projects: { id: string; name: string; code: string | null; role: string }[];
}

interface AuthState {
  mode: 'dev' | 'supabase' | null;
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ mode: null, me: null, loading: true, refresh: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthState['mode']>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMe(await api<Me>('/me'));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api<{ authMode: 'dev' | 'supabase' }>('/config', { auth: false })
      .then((c) => setMode(c.authMode))
      .catch(() => setMode('dev'));
    refresh();
    const sb = getSupabase();
    const sub = sb?.auth.onAuthStateChange(() => refresh());
    return () => sub?.data.subscription.unsubscribe();
  }, [refresh]);

  const signOut = async () => {
    devUser.set(null);
    await getSupabase()?.auth.signOut();
    qc.clear();
    setMe(null);
  };

  return <Ctx.Provider value={{ mode, me, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
