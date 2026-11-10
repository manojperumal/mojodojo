// FR-08 / FR-10 foreman view by link — phone-first, no account.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Flag, Minus, Plus } from 'lucide-react';
import type { ConstraintCategory, Readiness } from '@lookahead/shared';
import { api } from '../lib/api';
import { fmtDate, fmtRange } from '../lib/format';
import { Button, ReadinessBadge, Spinner, Textarea, clsx, toast } from '../components/ui';
import { Logo } from '../components/Logo';

interface TaskView {
  id: string; name: string; activityName: string; area: string | null; plannedStart: string; plannedFinish: string; crewSize: number | null;
  readiness: Readiness; reasons: string[]; openConstraints: { id: string; number: number; description: string; status: string; neededBy: string | null }[];
}
interface View {
  project: { name: string };
  trade: { name: string; company: string | null; foremanName: string | null };
  weekStart: string;
  commitments: { id: string; status: string; crewSize: number | null; confirmedByName: string | null; task: TaskView }[];
  upcoming: TaskView[];
  categories: { key: ConstraintCategory; label: string }[];
}

const NAME_KEY = 'lookahead.foremanName';

export function ForemanPage() {
  const { token } = useParams();
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['foreman', token], queryFn: () => api<View>(`/f/${token}`, { auth: false }), retry: false });
  const [name, setName] = useState('');
  useEffect(() => {
    let n = '';
    try { n = localStorage.getItem(NAME_KEY) ?? ''; } catch { /* ignore */ }
    setName(n || data?.trade.foremanName || '');
  }, [data?.trade.foremanName]);
  const saveName = (n: string) => { setName(n); try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };

  if (isLoading) return <Spinner />;
  if (error || !data) return <div className="mx-auto max-w-md p-6 text-center"><Logo dark /><p className="mt-6 text-lg font-semibold">{(error as Error)?.message ?? 'Link not found.'}</p></div>;
  const pending = data.commitments.filter((c) => c.status === 'proposed').length;

  return (
    <div className="mx-auto min-h-full max-w-lg bg-slate-50 pb-16">
      <header className="bg-ink-900 px-4 py-4 text-white">
        <div className="text-xs uppercase tracking-widest text-brand-400">{data.project.name}</div>
        <h1 className="mt-1 text-2xl font-bold">{data.trade.name} — week of {fmtDate(data.weekStart)}</h1>
        <p className="mt-1 text-sm text-slate-300">{pending ? `Confirm your crew for ${pending} task${pending > 1 ? 's' : ''}. Flag anything that could stop the work.` : 'All tasks confirmed. Thanks — flag anything that changes.'}</p>
      </header>
      <div className="px-4 pt-3">
        <label className="text-xs font-semibold uppercase text-slate-500">Your name</label>
        <input className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base" value={name} onChange={(e) => saveName(e.target.value)} placeholder="Name" />
      </div>
      <section className="space-y-3 px-4 pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">This week’s plan</h2>
        {data.commitments.length === 0 && <p className="text-slate-500">Nothing planned for your crew yet.</p>}
        {data.commitments.map((c) => <CommitCard key={c.id} token={token!} c={c} name={name} categories={data.categories} onDone={refetch} />)}
      </section>
      {data.upcoming.length > 0 && (
        <section className="space-y-3 px-4 pt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Coming up — see a problem? Flag it now</h2>
          {data.upcoming.map((t) => (
            <div key={t.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <TaskHead t={t} />
              <FlagButton token={token!} taskId={t.id} name={name} categories={data.categories} onDone={refetch} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function TaskHead({ t }: { t: TaskView }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="text-lg font-semibold leading-snug">{t.name}</div>
        <ReadinessBadge state={t.readiness} />
      </div>
      <div className="text-sm text-slate-500">{[t.area, fmtRange(t.plannedStart, t.plannedFinish)].filter(Boolean).join(' · ')}</div>
      {t.openConstraints.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {t.openConstraints.map((c) => <li key={c.id} className="flex gap-1.5 text-constrained-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> #{c.number} {c.description}{c.status === 'raised' && ' (flagged)'}</li>)}
        </ul>
      )}
    </div>
  );
}

function CommitCard({ token, c, name, categories, onDone }: { token: string; c: View['commitments'][number]; name: string; categories: View['categories']; onDone: () => void }) {
  const [crew, setCrew] = useState(c.crewSize ?? c.task.crewSize ?? 1);
  const [busy, setBusy] = useState(false);
  const confirmed = c.status !== 'proposed';
  return (
    <div className={clsx('rounded-xl border bg-white p-4 shadow-sm', confirmed && 'border-ready-600/40')}>
      <TaskHead t={c.task} />
      {confirmed ? (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-ready-50 px-3 py-2 font-semibold text-ready-700"><Check className="h-5 w-5" /> Confirmed · crew of {c.crewSize}{c.confirmedByName ? ` · ${c.confirmedByName}` : ''}</div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center rounded-lg border">
            <button className="p-3" aria-label="Fewer" onClick={() => setCrew(Math.max(0, crew - 1))}><Minus className="h-5 w-5" /></button>
            <div className="w-16 text-center"><div className="text-2xl font-bold tabular-nums">{crew}</div><div className="-mt-1 text-[11px] text-slate-500">crew</div></div>
            <button className="p-3" aria-label="More" onClick={() => setCrew(crew + 1)}><Plus className="h-5 w-5" /></button>
          </div>
          <Button size="lg" variant="primary" className="flex-1" loading={busy} disabled={!name.trim()} onClick={async () => {
            setBusy(true);
            try { await api(`/f/${token}/commitments/${c.id}/confirm`, { body: { crewSize: crew, name }, auth: false }); toast('Confirmed'); onDone(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
          }}>
            <Check className="h-5 w-5" /> Confirm
          </Button>
        </div>
      )}
      {!name.trim() && !confirmed && <p className="mt-1 text-xs text-slate-500">Enter your name above to confirm.</p>}
      <FlagButton token={token} taskId={c.task.id} name={name} categories={categories} onDone={onDone} />
    </div>
  );
}

/** Two taps: Flag → category. Detail is optional afterwards. */
function FlagButton({ token, taskId, name, categories, onDone }: { token: string; taskId: string; name: string; categories: View['categories']; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<{ id: string; number: number } | null>(null);
  const [note, setNote] = useState('');
  if (sent)
    return (
      <div className="mt-3 rounded-md bg-brand-50 p-3 text-sm">
        <div className="font-semibold">Flagged as #{sent.number}. Your super will assign it.</div>
        <Textarea className="mt-2" rows={2} placeholder="Add detail (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setSent(null); setNote(''); }}>Done</Button>
          <Button size="sm" variant="dark" disabled={!note.trim()} onClick={async () => { await api(`/f/${token}/constraints/${sent.id}/note`, { body: { note, name }, auth: false }); toast('Detail added'); setSent(null); setNote(''); }}>Send detail</Button>
        </div>
      </div>
    );
  if (!open) return <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-3 text-base font-semibold text-slate-600" onClick={() => setOpen(true)}><Flag className="h-5 w-5" /> Flag a problem</button>;
  return (
    <div className="mt-3">
      <div className="mb-2 text-sm font-semibold">What’s missing?</div>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((c) => (
          <button key={c.key} className="rounded-lg border bg-slate-50 px-2 py-3 text-sm font-medium active:bg-brand-100" onClick={async () => {
            try {
              const r = await api(`/f/${token}/constraints`, { body: { taskId, category: c.key, name: name || undefined }, auth: false });
              setSent(r); setOpen(false); onDone();
            } catch (e) { toast((e as Error).message, 'error'); }
          }}>{c.label}</button>
        ))}
      </div>
      <button className="mt-2 w-full py-2 text-sm text-slate-500" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
