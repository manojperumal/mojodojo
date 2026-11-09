import { useEffect, useState } from 'react';
import { AlertTriangle, CircleAlert, Plus, Trash2, Wrench } from 'lucide-react';
import { CX_LEVEL_LABELS, READINESS_LABELS, READINESS_STATES, type Activity, type Readiness } from '@lookahead/shared';
import { useAct, useBundle, useLookups } from '../lib/hooks';
import { fmtDate, fmtRange } from '../lib/format';
import { Badge, Button, Drawer, Field, Input, ReadinessBadge, Select, StatusBadge, Textarea, clsx } from './ui';
import { ConstraintForm } from './ConstraintForm';
import { History } from './History';

export function ActivityDrawer({ activityId, onClose, onOpenConstraint }: { activityId: string | null; onClose: () => void; onOpenConstraint?: (id: string) => void }) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const a = activityId ? L.activity.get(activityId) : undefined;
  if (!b || !a) return null;
  const r = b.readiness[a.id];
  return (
    <Drawer
      open={!!a}
      onClose={onClose}
      title={a.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <ReadinessBadge state={r.state} size="lg" overridden={r.overridden} />
          <span>{[L.area.get(a.areaId ?? '')?.name, L.system.get(a.systemId ?? '')?.name, L.trade.get(a.tradeId ?? '')?.name].filter(Boolean).join(' · ')}</span>
          {a.cxLevel && <Badge tone="dark">L{a.cxLevel}</Badge>}
        </span>
      }
    >
      <ActivityBody a={a} onOpenConstraint={onOpenConstraint} />
    </Drawer>
  );
}

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function ActivityBody({ a, onOpenConstraint }: { a: Activity; onOpenConstraint?: (id: string) => void }) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { run, pending } = useAct();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(a);
  useEffect(() => setForm(a), [a]);
  if (!b) return null;
  const r = b.readiness[a.id];
  const constraints = b.constraints.filter((c) => c.activityId === a.id);
  const tasks = b.tasks.filter((t) => t.activityId === a.id);
  const milestones = b.milestones.filter((m) => m.activityIds.includes(a.id));
  const ro = !L.isSuper;
  const dirty = (['name', 'plannedStart', 'plannedFinish', 'actualStart', 'actualFinish', 'tradeId', 'areaId', 'systemId', 'crewSize', 'cxLevel'] as const).filter((k) => form[k] !== a[k]);
  const memberNames = new Map(b.members.map((m) => [m.userId, m.name]));

  return (
    <div>
      <Section title="Why this state">
        {r.reasons.length === 0 ? (
          <p className="text-sm text-ready-700">All constraints cleared. This work can be committed.</p>
        ) : (
          <ul className="space-y-1.5">
            {r.reasons.map((x, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {x.severity === 'at_risk' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-600" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-constrained-600" />}
                {x.constraintId && onOpenConstraint ? (
                  <button className="text-left hover:underline" onClick={() => onOpenConstraint(x.constraintId!)}>
                    {x.text}
                  </button>
                ) : (
                  <span>{x.text}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <OverrideControl a={a} computed={r.computed} />
      </Section>

      <Section title="Details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Activity" className="col-span-2">
            <Input disabled={ro} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Planned start">
            <Input disabled={ro} type="date" value={form.plannedStart} onChange={(e) => setForm({ ...form, plannedStart: e.target.value })} />
          </Field>
          <Field label="Planned finish">
            <Input disabled={ro} type="date" value={form.plannedFinish} onChange={(e) => setForm({ ...form, plannedFinish: e.target.value })} />
          </Field>
          <Field label="Actual start">
            <Input disabled={ro} type="date" value={form.actualStart ?? ''} onChange={(e) => setForm({ ...form, actualStart: e.target.value || null })} />
          </Field>
          <Field label="Actual finish">
            <Input disabled={ro} type="date" value={form.actualFinish ?? ''} onChange={(e) => setForm({ ...form, actualFinish: e.target.value || null })} />
          </Field>
          <Field label="Trade">
            <Select disabled={ro} value={form.tradeId ?? ''} onChange={(e) => setForm({ ...form, tradeId: e.target.value || null })}>
              <option value="">—</option>
              {b.trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Crew size">
            <Input disabled={ro} type="number" min={0} value={form.crewSize ?? ''} onChange={(e) => setForm({ ...form, crewSize: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Area / zone">
            <Select disabled={ro} value={form.areaId ?? ''} onChange={(e) => setForm({ ...form, areaId: e.target.value || null })}>
              <option value="">—</option>
              {b.areas.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="System">
            <Select disabled={ro} value={form.systemId ?? ''} onChange={(e) => setForm({ ...form, systemId: e.target.value || null })}>
              <option value="">—</option>
              {b.systems.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Commissioning level" className="col-span-2">
            <Select disabled={ro} value={form.cxLevel ?? ''} onChange={(e) => setForm({ ...form, cxLevel: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Not a commissioning activity</option>
              {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{CX_LEVEL_LABELS[l]}</option>)}
            </Select>
          </Field>
        </div>
        {!ro && dirty.length > 0 && (
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={() => setForm(a)}>Discard</Button>
            <Button variant="primary" loading={pending} onClick={() => run(`/activities/${a.id}`, Object.fromEntries(dirty.map((k) => [k, form[k]])), 'PATCH', 'Activity saved')}>
              Save changes
            </Button>
          </div>
        )}
      </Section>

      <Section title={`Constraints (${constraints.filter((c) => c.status !== 'cleared').length} open)`} actions={L.canCreateConstraint && !adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add constraint</Button>}>
        {adding && <div className="mb-3"><ConstraintForm activityId={a.id} onDone={() => setAdding(false)} /></div>}
        {constraints.length === 0 && !adding && <p className="text-sm text-slate-500">No constraints logged. What must happen before this can start?</p>}
        <ul className="divide-y rounded-md border">
          {constraints.map((c) => (
            <li key={c.id}>
              <button className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onOpenConstraint?.(c.id)}>
                <span>
                  <span className="text-slate-500">#{c.number}</span> {c.description}
                  <span className="block text-xs text-slate-500">
                    {c.ownerUserId ? memberNames.get(c.ownerUserId) : <b className="text-risk-700">No owner</b>} · needed {fmtDate(c.neededBy)}
                    {c.promisedDate && ` · promised ${fmtDate(c.promisedDate)}`}
                  </span>
                </span>
                <StatusBadge status={c.status} />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Crew tasks (${tasks.length})`}>
        <TaskList activity={a} />
      </Section>

      <Section title="Predecessors">
        <LinkList
          ids={a.predecessorIds}
          options={b.activities.filter((x) => x.id !== a.id).map((x) => ({ id: x.id, label: x.name }))}
          render={(id) => {
            const p = L.activity.get(id);
            return p ? <span>{p.name} <span className="text-slate-500">· {fmtRange(p.plannedStart, p.plannedFinish)}{p.actualFinish ? ' · done' : ''}</span></span> : null;
          }}
          onChange={ro ? undefined : (ids) => run(`/activities/${a.id}`, { predecessorIds: ids }, 'PATCH')}
        />
      </Section>

      <Section title="Equipment">
        <LinkList
          ids={a.equipmentIds}
          options={b.equipment.map((e) => ({ id: e.id, label: `${e.tag} — ${e.description ?? ''}` }))}
          render={(id) => {
            const e = L.equipment.get(id);
            if (!e) return null;
            return (
              <span className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-400" /> {e.tag}
                <span className="text-slate-500">
                  {e.actualDelivery ? `delivered ${fmtDate(e.actualDelivery)}` : `required ${fmtDate(e.requiredOnSite)} · promised ${fmtDate(e.promisedDelivery)}`}
                </span>
              </span>
            );
          }}
          onChange={ro ? undefined : (ids) => run(`/activities/${a.id}`, { equipmentIds: ids }, 'PATCH')}
        />
      </Section>

      {milestones.length > 0 && (
        <Section title="Milestones">
          <ul className="space-y-1 text-sm">
            {milestones.map((m) => (
              <li key={m.id}>
                {m.kind === 'energization' && <Badge tone="amber" className="mr-1">Energization gate</Badge>}
                {m.name} · target {fmtDate(m.targetDate)}
                {b.gates[m.id] && <span className={clsx('ml-2 text-xs font-semibold', b.gates[m.id].cleared ? 'text-ready-700' : 'text-constrained-700')}>{b.gates[m.id].cleared ? 'Gate cleared' : 'Gate not cleared'}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="History">
        <History pid={b.project.id} entityType="activity" entityId={a.id} names={memberNames} />
      </Section>
    </div>
  );
}

function OverrideControl({ a, computed }: { a: Activity; computed: Readiness }) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { run, pending } = useAct();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<Readiness>(computed === 'ready' ? 'constrained' : 'ready');
  const [note, setNote] = useState('');
  if (a.readinessOverride)
    return (
      <div className="mt-3 rounded-md border border-brand-400 bg-brand-50 p-3 text-sm">
        <b>Super override: {READINESS_LABELS[a.readinessOverride]}</b> (computed: {READINESS_LABELS[computed]})
        <p className="mt-1 text-slate-700">“{a.overrideNote}” — {L.member.get(a.overrideBy ?? '')?.name ?? 'super'}, {fmtDate(a.overrideAt?.slice(0, 10))}</p>
        {L.isSuper && (
          <Button size="sm" className="mt-2" loading={pending} onClick={() => run(`/activities/${a.id}/override`, { state: null }, 'POST', 'Override removed')}>
            Remove override
          </Button>
        )}
      </div>
    );
  if (!L.isSuper) return null;
  if (!open)
    return (
      <button className="mt-2 text-sm text-slate-500 underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
        Override readiness…
      </button>
    );
  return (
    <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-600">Overrides are logged with your name and note.</p>
      <Select value={state} onChange={(e) => setState(e.target.value as Readiness)}>
        {READINESS_STATES.map((s) => <option key={s} value={s}>{READINESS_LABELS[s]}</option>)}
      </Select>
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? e.g. Vendor confirmed by phone, PO to follow" />
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={!note.trim()} loading={pending} onClick={async () => { await run(`/activities/${a.id}/override`, { state, note }, 'POST', 'Override saved'); setOpen(false); }}>
          Save override
        </Button>
      </div>
    </div>
  );
}

function TaskList({ activity }: { activity: Activity }) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { run, pending } = useAct();
  const [f, setF] = useState<{ name: string; crewSize: string; plannedStart: string; plannedFinish: string } | null>(null);
  if (!b) return null;
  const tasks = b.tasks.filter((t) => t.activityId === activity.id);
  return (
    <div>
      <ul className="divide-y rounded-md border">
        {tasks.map((t) => {
          const cm = b.commitments.filter((c) => c.taskId === t.id).at(-1);
          return (
            <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {t.name}
                <span className="block text-xs text-slate-500">
                  {L.trade.get(t.tradeId ?? '')?.name ?? '—'} · crew {t.crewSize ?? '—'} · {fmtRange(t.plannedStart, t.plannedFinish)}
                  {cm && ` · committed wk ${fmtDate(cm.weekStart)} (${cm.status.replace('_', ' ')})`}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <ReadinessBadge state={b.taskReadiness[t.id]?.state ?? 'ready'} />
                {L.isSuper && tasks.length > 1 && (
                  <button title="Delete task" className="text-slate-400 hover:text-risk-600" onClick={() => run(`/tasks/${t.id}`, undefined, 'DELETE', 'Task removed')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {L.isSuper &&
        (f ? (
          <div className="mt-2 grid grid-cols-6 gap-2 rounded-md border bg-slate-50 p-2">
            <Input className="col-span-6" autoFocus placeholder="Task, e.g. Pre-functional checklist CRAH-2-03" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <Input className="col-span-2" type="date" value={f.plannedStart} onChange={(e) => setF({ ...f, plannedStart: e.target.value })} />
            <Input className="col-span-2" type="date" value={f.plannedFinish} onChange={(e) => setF({ ...f, plannedFinish: e.target.value })} />
            <Input className="col-span-2" type="number" min={0} placeholder="Crew" value={f.crewSize} onChange={(e) => setF({ ...f, crewSize: e.target.value })} />
            <div className="col-span-6 flex justify-end gap-2">
              <Button size="sm" onClick={() => setF(null)}>Cancel</Button>
              <Button
                size="sm"
                variant="primary"
                loading={pending}
                disabled={!f.name.trim()}
                onClick={async () => {
                  await run(`/activities/${activity.id}/tasks`, { name: f.name, plannedStart: f.plannedStart, plannedFinish: f.plannedFinish, crewSize: f.crewSize ? Number(f.crewSize) : null }, 'POST', 'Task added');
                  setF(null);
                }}
              >
                Add task
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="mt-1" onClick={() => setF({ name: '', crewSize: String(activity.crewSize ?? ''), plannedStart: activity.plannedStart, plannedFinish: activity.plannedFinish })}>
            <Plus className="h-4 w-4" /> Split into another crew task
          </Button>
        ))}
    </div>
  );
}

function LinkList({ ids, options, render, onChange }: { ids: string[]; options: { id: string; label: string }[]; render: (id: string) => React.ReactNode; onChange?: (ids: string[]) => void }) {
  const [adding, setAdding] = useState('');
  return (
    <div>
      {ids.length === 0 && <p className="text-sm text-slate-500">None.</p>}
      <ul className="space-y-1 text-sm">
        {ids.map((id) => (
          <li key={id} className="flex items-center justify-between gap-2">
            {render(id)}
            {onChange && (
              <button className="text-slate-400 hover:text-risk-600" title="Remove" onClick={() => onChange(ids.filter((x) => x !== id))}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {onChange && (
        <Select
          className="mt-2"
          value={adding}
          onChange={(e) => {
            setAdding('');
            if (e.target.value) onChange([...ids, e.target.value]);
          }}
        >
          <option value="">+ Link…</option>
          {options.filter((o) => !ids.includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </Select>
      )}
    </div>
  );
}
