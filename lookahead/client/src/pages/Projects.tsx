import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Plus } from 'lucide-react';
import { ROLE_LABELS, type Role } from '@lookahead/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Empty, Field, Input, Modal, Select, toast } from '../components/ui';
import { Logo } from '../components/Logo';

export function ProjectsPage() {
  const { me, refresh, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, workDays: 5 });
  const navigate = useNavigate();
  const projects = me?.projects ?? [];
  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between bg-ink-900 px-4 py-3 text-white">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300">{me?.user.name}</span>
          <button onClick={signOut} title="Sign out" className="rounded p-1.5 hover:bg-white/10">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New project
          </Button>
        </div>
        {projects.length === 0 ? (
          <Empty title="No projects yet">Create a project, then import a P6 export or CSV, or start from a pre-commissioning template.</Empty>
        ) : (
          <ul className="divide-y rounded-lg border bg-white shadow-sm">
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/p/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <span>
                    <span className="font-semibold">{p.name}</span>
                    {p.code && <span className="ml-2 text-sm text-slate-500">{p.code}</span>}
                  </span>
                  <span className="text-sm text-slate-500">{ROLE_LABELS[p.role as Role]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New project"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!form.name.trim()}
              onClick={async () => {
                try {
                  const p = await api('/projects', { body: { ...form, code: form.code || undefined } });
                  await refresh();
                  navigate(`/p/${p.id}/setup`);
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Project name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ashburn DC-4 — Pre-commissioning" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code (optional)">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Work week">
              <Select value={form.workDays} onChange={(e) => setForm({ ...form, workDays: Number(e.target.value) })}>
                <option value={5}>5 days (Mon–Fri)</option>
                <option value={6}>6 days (Mon–Sat)</option>
                <option value={7}>7 days</option>
              </Select>
            </Field>
          </div>
          <Field label="Site time zone" hint="Used for “today”, escalations and the Monday roll-forward.">
            <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </Field>
          <p className="text-sm text-slate-500">You’ll be the superintendent on this project. You can add your team next.</p>
        </div>
      </Modal>
    </div>
  );
}
