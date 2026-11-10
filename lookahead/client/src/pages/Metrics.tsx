// §10 metrics — PPC, delay, constraint clearance, RFI cycle time — plus product health.
// Also the owner's-rep read-only dashboard (FR-14).
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { VARIANCE_LABELS } from '@lookahead/shared';
import { api } from '../lib/api';
import { usePid } from '../lib/hooks';
import { fmtDate, pct } from '../lib/format';
import { Card, Spinner, Stat, clsx } from '../components/ui';

export function MetricsPage() {
  const pid = usePid();
  const { data: m, isLoading } = useQuery({ queryKey: ['metrics', pid], queryFn: () => api<any>(`/projects/${pid}/metrics`) });
  if (isLoading || !m) return <Spinner />;
  const closedWeeks = m.ppc.weeks.filter((w: any) => w.ppc != null);
  const last = closedWeeks.at(-1);
  const prev = closedWeeks.at(-2);
  const trend = m.ppc.weeks.slice(0, -1).map((w: any) => ({ week: fmtDate(w.weekStart), ppc: w.ppc == null ? null : Math.round(w.ppc * 100), committed: w.committed }));
  const variance = m.ppc.variance.map((v: any) => ({ reason: VARIANCE_LABELS[v.reason as keyof typeof VARIANCE_LABELS], count: v.count })).sort((a: any, b: any) => b.count - a.count);
  const c = m.clearance;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="PPC — last closed week" value={pct(last?.ppc)} sub={last ? `${last.done} of ${last.done + last.notDone} committed tasks done${prev?.ppc != null ? ` · ${last.ppc >= prev.ppc ? '▲' : '▼'} from ${pct(prev.ppc)}` : ''}` : 'No closed weeks yet'} tone={last?.ppc == null ? undefined : last.ppc >= 0.8 ? 'good' : last.ppc >= 0.6 ? 'warn' : 'bad'} />
        <Stat label="Constraints cleared by needed-by" value={pct(c.onTimeRate)} sub={`${c.clearedOnTime} on time · ${c.missedOrOverdue} missed or overdue`} />
        <Stat label="Constraints without owner / date" value={c.orphaned} sub="Target: zero" tone={c.orphaned === 0 ? 'good' : 'bad'} />
        <Stat label="Median RFI cycle time" value={m.rfi.medianCycleDays == null ? '—' : `${m.rfi.medianCycleDays}d`} sub={`${pct(m.rfi.answeredBeforeWorkRate)} answered before the work was scheduled · ${m.rfi.open} open`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Percent Plan Complete — rolling 6 weeks">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={false} width={44} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'PPC']} />
                <Line type="monotone" dataKey="ppc" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 4, fill: '#e8a317', stroke: '#0f172a' }} connectNulls>
                  <LabelList dataKey="ppc" position="top" formatter={(v: any) => (v == null ? '' : `${v}%`)} style={{ fontSize: 12, fill: '#0f172a', fontWeight: 600 }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Why committed work was missed (6 weeks)">
          {variance.length === 0 ? <p className="text-sm text-slate-500">No misses recorded.</p> : (
            <div style={{ height: Math.max(120, variance.length * 34) }}>
              <ResponsiveContainer>
                <BarChart data={variance} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="reason" width={110} tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} />
                  <Bar dataKey="count" fill="#e8a317" radius={[0, 3, 3, 0]} barSize={18}>
                    <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: '#0f172a', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="PPC by trade (6 weeks)" bodyClass="p-0">
          <GroupTable rows={m.ppc.byTrade} />
        </Card>
        <Card title="PPC by area (6 weeks)" bodyClass="p-0">
          <GroupTable rows={m.ppc.byArea} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Constraint clearance">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Logged</dt><dd className="text-right font-semibold tabular-nums">{c.total}</dd>
            <dt className="text-slate-500">Open now</dt><dd className="text-right font-semibold tabular-nums">{c.active}</dd>
            <dt className="text-slate-500">Cleared early</dt><dd className="text-right font-semibold tabular-nums text-ready-700">{c.clearedEarly} ({pct(c.clearedEarlyRate)})</dd>
            <dt className="text-slate-500">Cleared late</dt><dd className="text-right font-semibold tabular-nums">{c.clearedLate}</dd>
            <dt className="text-slate-500">Median days raised → cleared</dt><dd className="text-right font-semibold tabular-nums">{c.medianDaysToClear ?? '—'}</dd>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Cleared early = cleared before its needed-by date. Prevention gets credit.</p>
        </Card>
        <Card title="On-time starts (delay)">
          <div className="text-3xl font-bold">{pct(m.delay.onTimeRate)}</div>
          <p className="text-sm text-slate-500">{m.delay.startedOnTime} of {m.delay.dueToStart} activities due in the last 6 weeks started on their planned date · {m.delay.notStarted} not started</p>
          <div className="mt-3 flex items-end gap-1">
            {m.delay.byWeek.map((w: any) => (
              <div key={w.weekStart} className="flex-1 text-center">
                <div className="mx-auto w-full rounded-t bg-slate-200" style={{ height: 60 }}>
                  <div className="w-full rounded-t bg-ink-800" style={{ height: `${(w.rate ?? 0) * 60}px`, marginTop: `${60 - (w.rate ?? 0) * 60}px` }} />
                </div>
                <div className="mt-1 text-[10px] text-slate-500">{fmtDate(w.weekStart)}</div>
                <div className="text-[11px] font-semibold">{w.due ? pct(w.rate) : '—'}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Plan health">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Rolled forward this week</dt><dd className={clsx('text-right font-semibold', m.health.rolledThisWeek ? 'text-ready-700' : 'text-risk-700')}>{m.health.rolledThisWeek ? 'Yes' : 'No'}</dd>
            <dt className="text-slate-500">Activities in 3-week window</dt><dd className="text-right font-semibold tabular-nums">{m.health.activitiesInWindow}</dd>
            <dt className="text-slate-500">Stale (7+ days untouched)</dt><dd className="text-right font-semibold tabular-nums">{m.health.staleActivities}</dd>
            <dt className="text-slate-500">Foreman confirmation rate</dt><dd className="text-right font-semibold tabular-nums">{pct(m.health.foremanConfirmationRate)}</dd>
            <dt className="text-slate-500">READY / CONSTRAINED / AT RISK</dt><dd className="text-right font-semibold tabular-nums">{m.readinessMix.ready} / {m.readinessMix.constrained} / {m.readinessMix.atRisk}</dd>
          </dl>
        </Card>
      </div>

      <Card title="Milestones — forecast vs target" bodyClass="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2">Milestone</th><th className="px-4 py-2">Target</th><th className="px-4 py-2">Forecast</th><th className="px-4 py-2">Variance</th><th className="px-4 py-2">Confidence</th></tr>
          </thead>
          <tbody>
            {m.milestones.map((x: any) => (
              <tr key={x.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{x.name}</td>
                <td className="px-4 py-2 tabular-nums">{fmtDate(x.targetDate)}</td>
                <td className="px-4 py-2 tabular-nums">{fmtDate(x.forecastDate)}</td>
                <td className={clsx('px-4 py-2 font-semibold tabular-nums', x.varianceDays > 0 ? 'text-risk-700' : 'text-ready-700')}>{x.varianceDays == null ? '—' : x.varianceDays === 0 ? 'on target' : x.varianceDays > 0 ? `+${x.varianceDays}d late` : `${-x.varianceDays}d early`}</td>
                <td className="px-4 py-2 capitalize">{x.confidence ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function GroupTable({ rows }: { rows: { key: string; committed: number; done: number; notDone: number; ppc: number | null }[] }) {
  if (!rows.length) return <p className="p-4 text-sm text-slate-500">No marked commitments yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="border-b bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <tr><th className="px-4 py-2">Group</th><th className="px-4 py-2 text-right">Committed</th><th className="px-4 py-2 text-right">Done</th><th className="w-1/3 px-4 py-2">PPC</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b last:border-0">
            <td className="px-4 py-2 font-medium">{r.key}</td>
            <td className="px-4 py-2 text-right tabular-nums">{r.committed}</td>
            <td className="px-4 py-2 text-right tabular-nums">{r.done}</td>
            <td className="px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded bg-slate-100"><div className="h-2 rounded bg-ink-800" style={{ width: `${(r.ppc ?? 0) * 100}%` }} /></div>
                <span className="w-10 text-right font-semibold tabular-nums">{pct(r.ppc)}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
