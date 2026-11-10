// FR-11 daily huddle view — readable from 2 metres on a trailer display.
import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { addDays, isWorkDay, ppcByWeek, weekStart, type ProjectBundle } from '@lookahead/shared';
import { useBundle, useLookups } from '../lib/hooks';
import { fmtDate, pct } from '../lib/format';
import { ReadinessBadge, clsx } from '../components/ui';

function nextWorkDay(d: string, workDays: number, dir = 1) {
  let x = addDays(d, dir);
  while (!isWorkDay(x, workDays)) x = addDays(x, dir);
  return x;
}

export function huddleData(b: ProjectBundle) {
  const today = b.today;
  const tomorrow = nextWorkDay(today, b.project.workDays);
  const yesterday = nextWorkDay(today, b.project.workDays, -1);
  const starts = b.tasks.filter((t) => t.plannedStart === today);
  const dueToday = b.constraints.filter((c) => c.status !== 'cleared' && c.neededBy && c.neededBy <= today).sort((x, y) => (x.neededBy! < y.neededBy! ? -1 : 1));
  const missedConstraints = b.constraints.filter((c) => c.status === 'missed' && c.neededBy && c.neededBy >= yesterday);
  const missedTasks = b.commitments.filter((c) => c.status !== 'done' && c.status !== 'proposed' && (c.promisedFinish ?? '') >= yesterday && (c.promisedFinish ?? '') < today);
  const tomorrowRisk = b.tasks.filter((t) => t.plannedStart > today && t.plannedStart <= tomorrow && b.taskReadiness[t.id]?.state !== 'ready');
  return { today, tomorrow, yesterday, starts, dueToday, missedConstraints, missedTasks, tomorrowRisk };
}

export function HuddlePage() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const h = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  if (!b) return null;
  const d = huddleData(b);
  const ppc = ppcByWeek(b.commitments, [addDays(weekStart(b.today), -7)])[0];
  const owner = (id: string | null) => (id ? L.member.get(id)?.name : null) ?? 'NO OWNER';
  const trade = (id: string | null) => L.trade.get(id ?? '')?.name ?? '';

  return (
    <div className="min-h-[calc(100vh-88px)] bg-ink-900 p-6 text-white">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-widest text-brand-400">Morning huddle</div>
          <h1 className="text-4xl font-bold">{fmtDate(d.today, true)}</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm uppercase tracking-wide text-slate-400">Last week PPC</div>
            <div className="text-4xl font-bold tabular-nums">{pct(ppc.ppc)}</div>
          </div>
          <button className="no-print rounded p-2 text-slate-400 hover:bg-white/10" title="Full screen" onClick={() => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>
            {full ? <Minimize2 className="h-6 w-6" /> : <Maximize2 className="h-6 w-6" />}
          </button>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Today’s starts" count={d.starts.length} empty="No crew tasks start today.">
          {d.starts.map((t) => (
            <Row key={t.id} main={t.name} sub={`${trade(t.tradeId)} · crew ${t.crewSize ?? '—'}`} right={<ReadinessBadge size="lg" state={b.taskReadiness[t.id]?.state ?? 'ready'} />} />
          ))}
        </Panel>
        <Panel title="Constraints due today or overdue" count={d.dueToday.length} tone={d.dueToday.length ? 'bad' : undefined} empty="Nothing due. Good.">
          {d.dueToday.map((c) => (
            <Row key={c.id} main={`#${c.number} ${c.description}`} sub={c.neededBy === d.today ? 'Due today' : `Was due ${fmtDate(c.neededBy)}`} right={<span className={clsx('text-xl font-bold', !c.ownerUserId && 'text-risk-600')}>{owner(c.ownerUserId)}</span>} />
          ))}
        </Panel>
        <Panel title="Yesterday’s misses" count={d.missedConstraints.length + d.missedTasks.length} tone={d.missedConstraints.length + d.missedTasks.length ? 'warn' : undefined} empty="No misses yesterday.">
          {d.missedTasks.map((c) => (
            <Row key={c.id} main={L.task.get(c.taskId)?.name ?? ''} sub={`${trade(c.tradeId)} · ${c.status === 'not_done' ? 'not done' : 'not marked done'}`} right={<span className="text-lg text-brand-400">Task</span>} />
          ))}
          {d.missedConstraints.map((c) => (
            <Row key={c.id} main={`#${c.number} ${c.description}`} sub={`Missed · ${owner(c.ownerUserId)}`} right={<span className="text-lg text-risk-600">Constraint</span>} />
          ))}
        </Panel>
        <Panel title={`Not ready for ${fmtDate(d.tomorrow, true)}`} count={d.tomorrowRisk.length} tone={d.tomorrowRisk.length ? 'bad' : undefined} empty="Everything starting next is READY.">
          {d.tomorrowRisk.map((t) => {
            const r = b.taskReadiness[t.id];
            return <Row key={t.id} main={t.name} sub={r?.reasons[0]?.text ?? ''} right={<ReadinessBadge size="lg" state={r?.state ?? 'ready'} />} />;
          })}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, count, tone, empty, children }: { title: string; count: number; tone?: 'bad' | 'warn'; empty: string; children: React.ReactNode }) {
  return (
    <section className={clsx('rounded-xl border-2 bg-ink-800 p-5', tone === 'bad' ? 'border-risk-600' : tone === 'warn' ? 'border-brand-500' : 'border-slate-700')}>
      <h2 className="mb-3 flex items-center justify-between text-2xl font-bold">
        {title}
        <span className={clsx('rounded-full px-3 text-2xl tabular-nums', tone === 'bad' ? 'bg-risk-600' : tone === 'warn' ? 'bg-brand-500 text-ink-900' : 'bg-slate-700')}>{count}</span>
      </h2>
      {count === 0 ? <p className="text-xl text-slate-400">{empty}</p> : <ul className="space-y-3">{children}</ul>}
    </section>
  );
}

function Row({ main, sub, right }: { main: string; sub: string; right: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-slate-700 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-snug">{main}</div>
        <div className="text-base text-slate-400">{sub}</div>
      </div>
      <div className="shrink-0">{right}</div>
    </li>
  );
}
