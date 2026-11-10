// Project setup: team & roles (FR-14), trades with foreman contacts, areas, systems, settings.
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AREA_KINDS, ROLES, ROLE_LABELS, SYSTEM_TYPES, SYSTEM_TYPE_LABELS, type Role } from '@lookahead/shared';
import { useAuth } from '../lib/auth';
import { useAct, useBundle, useLookups } from '../lib/hooks';
import { Button, Card, Field, Input, Select } from '../components/ui';

export function SetupPage() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  if (!b) return null;
  return (
    <div className="grid max-w-6xl gap-5 lg:grid-cols-2">
      <Team />
      <Trades />
      <Areas />
      <Systems />
      {L.isSuper && <Settings />}
    </div>
  );
}

function Team() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { me } = useAuth();
  const { run, pending } = useAct();
  const [f, setF] = useState({ name: '', email: '', role: 'pm' as Role, tradeId: '' });
  if (!b) return null;
  return (
    <Card title="Team and roles" className="lg:col-span-2" bodyClass="p-0">
      <table className="w-full text-sm">
        <thead className="border-b bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Trade</th><th /></tr>
        </thead>
        <tbody>
          {b.members.map((m) => (
            <tr key={m.userId} className="border-b">
              <td className="px-4 py-2 font-medium">{m.name}</td>
              <td className="px-4 py-2 text-slate-600">{m.email}</td>
              <td className="px-4 py-2">
                {L.isSuper ? (
                  <Select className="!h-8" value={m.role} onChange={(e) => run(`/projects/${b.project.id}/members/${m.userId}`, { role: e.target.value }, 'PATCH', 'Role updated')}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </Select>
                ) : ROLE_LABELS[m.role]}
              </td>
              <td className="px-4 py-2">
                {m.role === 'foreman' && L.isSuper ? (
                  <Select className="!h-8" value={m.tradeId ?? ''} onChange={(e) => run(`/projects/${b.project.id}/members/${m.userId}`, { tradeId: e.target.value || null }, 'PATCH')}>
                    <option value="">—</option>
                    {b.trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                ) : L.trade.get(m.tradeId ?? '')?.name ?? ''}
              </td>
              <td className="px-2">
                {L.isSuper && m.userId !== me?.user.id && <button title="Remove" className="text-slate-400 hover:text-risk-600" onClick={() => confirm(`Remove ${m.name} from this project?`) && run(`/projects/${b.project.id}/members/${m.userId}`, undefined, 'DELETE', 'Removed')}><Trash2 className="h-4 w-4" /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {L.isSuper && (
        <div className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_180px_160px_auto] sm:items-end">
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select></Field>
          <Field label="Trade (foremen)"><Select disabled={f.role !== 'foreman'} value={f.tradeId} onChange={(e) => setF({ ...f, tradeId: e.target.value })}><option value="">—</option>{b.trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Button variant="primary" loading={pending} disabled={!f.name.trim() || !f.email.includes('@')} onClick={async () => { await run(`/projects/${b.project.id}/members`, { ...f, tradeId: f.tradeId || null }, 'POST', `${f.name} added`); setF({ name: '', email: '', role: 'pm', tradeId: '' }); }}>Add</Button>
        </div>
      )}
      <p className="px-4 pb-4 text-xs text-slate-500">Super: edit everything · PM / field engineer: own constraints, comment on all · Foreman: commit and raise constraints · CxA: sign off gates · Owner’s rep: read-only. Foremen don’t need an account — send them confirm links from the Weekly Plan.</p>
    </Card>
  );
}

function SimpleList<T extends { id: string; name: string }>({ title, table, rows, extra, fields }: { title: string; table: string; rows: T[]; extra: (r: T) => React.ReactNode; fields: (f: any, set: (f: any) => void) => React.ReactNode }) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { run, pending } = useAct();
  const [f, setF] = useState<any>({ name: '' });
  if (!b) return null;
  return (
    <Card title={title} bodyClass="p-0">
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
            <span><span className="font-medium">{r.name}</span> <span className="text-slate-500">{extra(r)}</span></span>
            {L.isSuper && <button title="Delete" className="text-slate-400 hover:text-risk-600" onClick={() => confirm(`Delete ${r.name}? Linked records keep their data but lose this link.`) && run(`/${table}/${r.id}`, undefined, 'DELETE', 'Deleted')}><Trash2 className="h-4 w-4" /></button>}
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">None yet.</li>}
      </ul>
      {L.isSuper && (
        <div className="flex flex-wrap items-end gap-2 border-t p-3">
          {fields(f, setF)}
          <Button variant="primary" loading={pending} disabled={!f.name?.trim()} onClick={async () => { await run(`/projects/${b.project.id}/${table}`, Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')), 'POST', 'Added'); setF({ name: '' }); }}>Add</Button>
        </div>
      )}
    </Card>
  );
}

function Trades() {
  const { data: b } = useBundle();
  if (!b) return null;
  return (
    <SimpleList
      title="Trades and foremen"
      table="trades"
      rows={b.trades}
      extra={(t) => [t.company, t.foremanName, t.foremanEmail].filter(Boolean).join(' · ')}
      fields={(f, set) => (
        <>
          <Input className="!w-36" placeholder="Trade" value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} />
          <Input className="!w-36" placeholder="Company" value={f.company ?? ''} onChange={(e) => set({ ...f, company: e.target.value })} />
          <Input className="!w-36" placeholder="Foreman" value={f.foremanName ?? ''} onChange={(e) => set({ ...f, foremanName: e.target.value })} />
          <Input className="!w-44" type="email" placeholder="Foreman email" value={f.foremanEmail ?? ''} onChange={(e) => set({ ...f, foremanEmail: e.target.value })} />
        </>
      )}
    />
  );
}

function Areas() {
  const { data: b } = useBundle();
  if (!b) return null;
  return (
    <SimpleList
      title="Areas (building, data hall, POD, room, zone)"
      table="areas"
      rows={b.areas}
      extra={(a) => a.kind.replace('_', ' ')}
      fields={(f, set) => (
        <>
          <Input className="!w-48" placeholder="e.g. Data Hall 3" value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} />
          <Select className="!w-36" value={f.kind ?? 'zone'} onChange={(e) => set({ ...f, kind: e.target.value })}>{AREA_KINDS.map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}</Select>
        </>
      )}
    />
  );
}

function Systems() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  if (!b) return null;
  return (
    <SimpleList
      title="Systems"
      table="systems"
      rows={b.systems}
      extra={(s) => `${SYSTEM_TYPE_LABELS[s.systemType]}${s.areaId ? ' · ' + (L.area.get(s.areaId)?.name ?? '') : ''}`}
      fields={(f, set) => (
        <>
          <Input className="!w-48" placeholder="e.g. UPS Plant C" value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} />
          <Select className="!w-44" value={f.systemType ?? 'other'} onChange={(e) => set({ ...f, systemType: e.target.value })}>{SYSTEM_TYPES.map((k) => <option key={k} value={k}>{SYSTEM_TYPE_LABELS[k]}</option>)}</Select>
          <Select className="!w-40" value={f.areaId ?? ''} onChange={(e) => set({ ...f, areaId: e.target.value })}><option value="">Area…</option>{b.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        </>
      )}
    />
  );
}

function Settings() {
  const { data: b } = useBundle();
  const { run, pending } = useAct();
  const [f, setF] = useState(b ? { name: b.project.name, timezone: b.project.timezone, workDays: b.project.workDays } : null);
  if (!b || !f) return null;
  return (
    <Card title="Project settings">
      <div className="space-y-3">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time zone"><Input value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} /></Field>
          <Field label="Work week"><Select value={f.workDays} onChange={(e) => setF({ ...f, workDays: Number(e.target.value) })}><option value={5}>5 days</option><option value={6}>6 days</option><option value={7}>7 days</option></Select></Field>
        </div>
        <p className="text-xs text-slate-500">V1 assumes the trailer has connectivity — the app needs to be online to save changes.</p>
        <Button variant="primary" loading={pending} onClick={() => run(`/projects/${b.project.id}`, f, 'PATCH', 'Settings saved')}>Save</Button>
      </div>
    </Card>
  );
}
