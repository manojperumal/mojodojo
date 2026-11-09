import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const DEV_USER_KEY = 'lookahead.devUser';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

let supabase: SupabaseClient | null = null;
export function getSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  supabase ??= createClient(url, key);
  return supabase;
}

export const devUser = {
  get: () => {
    try {
      return localStorage.getItem(DEV_USER_KEY);
    } catch {
      return null;
    }
  },
  set: (id: string | null) => {
    try {
      if (id) localStorage.setItem(DEV_USER_KEY, id);
      else localStorage.removeItem(DEV_USER_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

async function authHeaders(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    if (data.session) return { Authorization: `Bearer ${data.session.access_token}` };
  }
  const dev = devUser.get();
  return dev ? { 'x-dev-user': dev } : {};
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = opts.auth === false ? {} : await authHeaders();
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `Request failed (${res.status})`, json?.details);
  return json as T;
}

export const apiUrl = (path: string) => `${BASE}/api${path}`;
