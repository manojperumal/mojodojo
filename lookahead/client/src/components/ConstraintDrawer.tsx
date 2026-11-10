import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CATEGORY_LABELS, CONSTRAINT_CATEGORIES, VARIANCE_LABELS, VARIANCE_REASONS, diffDays, type Constraint, type ConstraintCategory, type ConstraintComment, type VarianceReason } from '@lookahead/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAct, useBundle, useLookups } from '../lib/hooks';
import { fmtDate, relDays, timeAgo } from '../lib/format';
import { Badge, Button, Drawer, Field, Input, Select, StatusBadge, Textarea } from './ui';
import { History } from './History';
import { ORPHAN_SENTENCE } from './ConstraintForm';

export function ConstraintDrawer({ constraintId, onClose, onOpenActivity }: { constraintId: string | null; onClose: () => void; onOpenActivity?: (id: string) => void }) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const c = constraintId ? L.constraint.get(constraintId) : undefined;
  if (!b || !c) return null;
  return (
    <Drawer open onClose={onClose} width="max-w-xl" title={<span><span className="text-slate-400">#{c.number}</span> {c.description}</span>} subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /><Badge>{CATEGORY_LABELS[c.category]}</Badge>{c.refNumber && <Badge tone="blue">{c.refNumber}</Badge>}</span>}>
      <Body c={c} onOpenActivity={onOpenActivity} />
    </Drawer>
  );
}

function Body({ c, onOpenActivity }: { c: Constraint; onOpenActivity?: (id: string) => void }) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { me } = useAuth();
  const { run, pending } = useAct();
  const [f, setF] = useState(c);
  const [mode, setMode] = useState<null | 'clear' | 'miss'>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<VarianceReason>('predecessor');
  useEffect(() => setF(c), [c]);
  if (!b) return null;
  const mine = c.ownerUserId === me?.user.id;
  const canEdit = L.isSuper || mine || (c.status === 'raised' && c.raisedByUserId === me?.user.id);
  const act = c.activityId ? L.activity.get(c.activityId) : undefined;
  const task = c.taskId ? L.task.get(c.taskId) : undefined;
  const ms = c.milestoneId ? L.milestone.get(c.milestoneId) : undefined;
  const age = diffDays(c.raisedAt.slice(0, 10), c.clearedAt?.slice(0, 10) ?? b.today);
  const dirtyKeys = (['description', 'category', 'ownerUserId', 'neededBy', 'promisedDate', 'refNumber'] as const).filter((k) => (f[k] ?? null) !== (c[k] ?? null));
  const orphan = !f.ownerUserId || !f.neededBy;
  const memberNames = new Map(b.members.map((m) => [m.userId, m.name]));
  const active = ['raised', 'open', 'promised', 'missed'].includes(c.status);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-slate-500">Blocks</div>
        <div>
          {act ? (
            <button className="text-left font-medium hover:underline" onClick={() => onOpenActivity?.(act.id)}>
              {act.name}
            </button>
          ) : ms ? (
            <span>{ms.kind === 'energization' ? 'Energization gate: ' : 'Milestone: '}{ms.name}</span>
          ) : (
            '—'
          )}
          {task && task.name !== act?.name && <div className="text-slate-500">Task: {task.name}</div>}
          {act && <div className="text-slate-500">Starts {fmtDate(act.plannedStart, true)} ({relDays(act.plannedStart, b.today)})</div>}
        </div>
        <div className="text-slate-500">Raised</div>
        <div>{fmtDate(c.raisedAt.slice(0, 10))} by {c.raisedByName ?? '—'} · {age}d {c.clearedAt ? 'to clear' : 'old'}</div>
        {c.clearedAt && (
          <>
            <div className="text-slate-500">Cleared</div>
            <div>
              {fmtDate(c.clearedAt.slice(0, 10))} — “{c.clearanceNote}”
              {c.neededBy && c.clearedAt.slice(0, 10) < c.neededBy && <Badge tone="green" className="ml-2">Cleared early</Badge>}
            </div>
          </>
        )}
        {c.status === 'missed' && (
          <>
            <div className="text-slate-500">Missed</div>
            <div className="text-risk-700">{c.varianceReason ? VARIANCE_LABELS[c.varianceReason] : 'Reason not logged yet'}</div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Description" className="col-span-2">
          <Input disabled={!canEdit} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Category">
          <Select disabled={!canEdit} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ConstraintCategory })}>
            {CONSTRAINT_CATEGORIES.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
          </Select>
        </Field>
        <Field label="Ref (RFI / submittal #)">
          <Input disabled={!canEdit} value={f.refNumber ?? ''} onChange={(e) => setF({ ...f, refNumber: e.target.value || null })} />
        </Field>
        <Field label="Owner" hint={!L.isSuper ? 'Only the super can reassign.' : undefined}>
          <Select disabled={!L.isSuper} value={f.ownerUserId ?? ''} onChange={(e) => setF({ ...f, ownerUserId: e.target.value || null })}>
            <option value="">— no owner —</option>
            {b.members.filter((m) => m.role !== 'owner_viewer').map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Needed by">
          <Input disabled={!canEdit} type="date" value={f.neededBy ?? ''} onChange={(e) => setF({ ...f, neededBy: e.target.value || null })} />
        </Field>
        <Field label="Promised date" className="col-span-2" hint={f.promisedDate && f.neededBy && f.promisedDate > f.neededBy ? <span className="text-risk-700">Promised after the needed-by date — linked work will show AT RISK.</span> : 'The date the owner commits to clear it.'}>
          <Input disabled={!canEdit || c.status === 'cleared'} type="date" value={f.promisedDate ?? ''} onChange={(e) => setF({ ...f, promisedDate: e.target.value || null })} />
        </Field>
      </div>
      {canEdit && dirtyKeys.length > 0 && (
        <div className="space-y-2">
          {orphan && c.status !== 'raised' && <p className="text-sm font-medium text-risk-700">{ORPHAN_SENTENCE}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setF(c)}>Discard</Button>
            <Button variant="primary" loading={pending} disabled={orphan && c.status !== 'raised'} onClick={() => run(`/constraints/${c.id}`, Object.fromEntries(dirtyKeys.map((k) => [k, f[k]])), 'PATCH', c.status === 'raised' && !orphan ? 'Constraint owned' : 'Saved')}>
              Save
            </Button>
          </div>
        </div>
      )}

      {canEdit && dirtyKeys.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {active && <Button variant="primary" onClick={() => setMode('clear')}>Mark cleared</Button>}
          {c.status === 'missed' && !c.varianceReason && <Button onClick={() => setMode('miss')}>Log miss reason</Button>}
          {['open', 'promised'].includes(c.status) && <Button variant="ghost" onClick={() => setMode('miss')}>Mark missed</Button>}
          {c.status === 'cleared' && <Button onClick={() => run(`/constraints/${c.id}`, { status: c.promisedDate ? 'promised' : 'open' }, 'PATCH', 'Reopened')}>Reopen</Button>}
          {L.isSuper && (
            <Button variant="ghost" className="ml-auto text-risk-700" onClick={() => confirm(`Delete constraint #${c.number}? This is logged.`) && run(`/constraints/${c.id}`, undefined, 'DELETE', 'Deleted')}>
              Delete
            </Button>
          )}
        </div>
      )}
      {mode === 'clear' && (
        <div className="space-y-2 rounded-md border border-ready-600/30 bg-ready-50 p-3">
          <Field label="How was it cleared?" hint="Evidence or confirmation — e.g. “RFI answered, rev 2 drawing issued”.">
            <Textarea rows={2} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setMode(null)}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={!note.trim()} loading={pending} onClick={async () => { await run(`/constraints/${c.id}`, { status: 'cleared', clearanceNote: note }, 'PATCH', `#${c.number} cleared`); setMode(null); setNote(''); }}>
              Clear constraint
            </Button>
          </div>
        </div>
      )}
      {mode === 'miss' && (
        <div className="space-y-2 rounded-md border border-risk-600/30 bg-risk-50 p-3">
          <Field label="Why was it missed?">
            <Select value={reason} onChange={(e) => setReason(e.target.value as VarianceReason)}>
              {VARIANCE_REASONS.map((r) => <option key={r} value={r}>{VARIANCE_LABELS[r]}</option>)}
            </Select>
          </Field>
          <p className="text-sm text-slate-600">Linked work is flagged AT RISK. Give a new promised date or clear it.</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setMode(null)}>Cancel</Button>
            <Button size="sm" variant="danger" loading={pending} onClick={async () => { await run(`/constraints/${c.id}`, { status: 'missed', varianceReason: reason }, 'PATCH', 'Logged'); setMode(null); }}>
              Save
            </Button>
          </div>
        </div>
      )}

      <Comments c={c} canComment={!L.readOnly} />

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">History</h3>
        <History pid={b.project.id} entityType="constraint" entityId={c.id} names={memberNames} />
      </section>
    </div>
  );
}

function Comments({ c, canComment }: { c: Constraint; canComment: boolean }) {
  const { data, refetch } = useQuery({ queryKey: ['comments', c.id], queryFn: () => api<ConstraintComment[]>(`/constraints/${c.id}/comments`) });
  const { run, pending } = useAct();
  const [text, setText] = useState('');
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Comments</h3>
      <ul className="space-y-2">
        {(data ?? []).map((m) => (
          <li key={m.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
            <div className="text-xs text-slate-500"><b className="text-slate-700">{m.authorName}</b> · {timeAgo(m.createdAt)}</div>
            <div className="whitespace-pre-wrap">{m.body}</div>
          </li>
        ))}
        {data?.length === 0 && <li className="text-sm text-slate-500">No comments.</li>}
      </ul>
      {canComment && (
        <div className="mt-2 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" onKeyDown={async (e) => { if (e.key === 'Enter' && text.trim()) { await run(`/constraints/${c.id}/comments`, { body: text }); setText(''); refetch(); } }} />
          <Button disabled={!text.trim()} loading={pending} onClick={async () => { await run(`/constraints/${c.id}/comments`, { body: text }); setText(''); refetch(); }}>Post</Button>
        </div>
      )}
    </section>
  );
}
