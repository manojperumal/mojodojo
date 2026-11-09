import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, devUser, getSupabase } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Field, Input, Spinner } from '../components/ui';
import { Logo } from '../components/Logo';
import { ROLE_LABELS, type Role } from '@lookahead/shared';

export function LoginPage() {
  const { me, mode, refresh } = useAuth();
  const navigate = useNavigate();
  if (me) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-full items-center justify-center bg-ink-900 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <Logo dark />
        <h1 className="mt-4 text-xl font-bold">The lookahead that clears constraints.</h1>
        <p className="mt-1 text-sm text-slate-600">Every constraint gets an owner and a needed-by date — and stays visible until it’s cleared.</p>
        <div className="mt-6">{mode === null ? <Spinner /> : mode === 'dev' ? <DevLogin onDone={async () => { await refresh(); navigate('/'); }} /> : <MagicLink />}</div>
      </div>
    </div>
  );
}

function DevLogin({ onDone }: { onDone: () => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['devUsers'], queryFn: () => api<{ id: string; name: string; email: string; roles: string | null }[]>('/dev/users', { auth: false }) });
  if (isLoading) return <Spinner />;
  if (error) return <p className="text-risk-700">Cannot reach the API. Is the server running?</p>;
  if (!data?.length) return <p className="text-sm text-slate-600">No users yet. Run <code className="rounded bg-slate-100 px-1">npm run db:seed</code> to load the sample project.</p>;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Development sign-in — pick a person</p>
      <ul className="divide-y rounded-md border">
        {data.map((u) => (
          <li key={u.id}>
            <button
              className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
              onClick={() => {
                devUser.set(u.id);
                onDone();
              }}
            >
              <span className="font-medium">{u.name}</span>
              <span className="text-xs text-slate-500">{(u.roles ?? '').split(', ').filter(Boolean).map((r) => ROLE_LABELS[r as Role] ?? r).join(', ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MagicLink() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sb = getSupabase();
  if (!sb) return <p className="text-risk-700">Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>;
  if (sent) return <p className="text-sm">Check <b>{email}</b> for a sign-in link.</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
        if (error) setErr(error.message);
        else setSent(true);
      }}
    >
      <Field label="Work email" error={err}>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </Field>
      <Button variant="primary" className="w-full" type="submit">
        Email me a sign-in link
      </Button>
    </form>
  );
}
