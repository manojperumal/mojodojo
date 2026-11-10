// FR-01 rolling board: activities across a 3-, 4- or 6-week window, grouped by area, system or trade.
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Plus, Printer, Search } from 'lucide-react';
import { addDays, diffDays, isWorkDay, STALE_DAYS, weekStart, type Activity, type ProjectBundle, type Readiness } from '@lookahead/shared';
import { useAct, useBundle, useLookups } from '../lib/hooks';
import { fmtDate, fmtRange } from '../lib/format';
import { Button, Empty, Field, Input, Modal, ReadinessBadge, Select, Tabs, clsx } from '../components/ui';
import { useDrawers } from '../components/Drawers';

type Group = 'area' | 'system' | 'trade';
type Filter = 'all' | 'not_ready' | 'at_risk';

function usePref<T extends string | number>(key: string, init: T) {
  const read = () => {
    try {
      const v = localStorage.getItem(`lookahead.${key}`);
      return v == null ? init : ((typeof init === 'number' ? Number(v) : v) as T);
    } catch {
      return init;
    }
  };
  const [v, setV] = useState<T>(read);
  return [
    v,
    (x: T) => {
      setV(x);
      try {
        localStorage.setItem(`lookahead.${key}`, String(x));
      } catch {
        /* ignore */
      }
    },
  ] as const;
}

export const LENS: Record<number, string> = { 0: 'Commit', 1: 'Make-ready', 2: 'Make-ready', 3: 'Lookahead', 4: 'Lookahead', 5: 'Lookahead' };
export const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const BAR: Record<Readiness, string> = {
  ready: 'bg-ready-600 border-ready-700 text-white',
  constrained: 'bg-[repeating-linear-gradient(135deg,#fdba74_0,#fdba74_6px,#fed7aa_6px,#fed7aa_12px)] border-constrained-600 text-constrained-700',
  at_risk: 'bg-risk-600 border-risk-700 text-white',
};

/** Template activities are named "<work> · <system>"; drop the suffix when the system is shown alongside. */
export function shortName(a: Activity, L: { system: Map<string, { name: string }> }) {
  const sys = a.systemId ? L.system.get(a.systemId)?.name : undefined;
  return sys && a.name.endsWith(` · ${sys}`) ? a.name.slice(0, -(sys.length + 3)) : a.name;
}

export function groupKey(b: ProjectBundle, a: Activity, g: Group, names: { area: Map<string, any>; system: Map<string, any>; trade: Map<string, any> }) {
  const id = g === 'area' ? a.areaId : g === 'system' ? a.systemId : a.tradeId;
  return (id && names[g].get(id)?.name) || `No ${g}`;
}

export function useWindow(b: ProjectBundle | undefined, weeks: number, group: Group, filter: Filter = 'all', search = '') {
  const L = useLookups(b);
  return useMemo(() => {
    if (!b) return { start: '', end: '', groups: [] as [string, Activity[]][] };
    const start = weekStart(b.today);
    const end = addDays(start, weeks * 7 - 1);
    const s = search.trim().toLowerCase();
    const rows = b.activities
      .filter((a) => a.plannedFinish >= start && a.plannedStart <= end)
      .filter((a) => !(a.actualFinish && a.actualFinish < b.today && a.plannedFinish < b.today)) // done work drops off
      .filter((a) => filter === 'all' || (filter === 'at_risk' ? b.readiness[a.id].state === 'at_risk' : b.readiness[a.id].state !== 'ready'))
      .filter((a) => !s || a.name.toLowerCase().includes(s) || groupKey(b, a, 'trade', L).toLowerCase().includes(s))
      .sort((x, y) => x.plannedStart.localeCompare(y.plannedStart) || x.name.localeCompare(y.name));
    const groups = new Map<string, Activity[]>();
    for (const a of rows) {
      const k = groupKey(b, a, group, L);
      groups.set(k, [...(groups.get(k) ?? []), a]);
    }
    return { start, end, groups: [...groups.entries()].sort((x, y) => x[0].localeCompare(y[0])) };
  }, [b, weeks, group, filter, search, L]);
}

export function BoardPage() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { run } = useAct();
  const drawers = useDrawers();
  const [weeks, setWeeks] = usePref<number>('weeks', 3);
  const [group, setGroup] = usePref<Group>('group', 'area');
  const [compact, setCompact] = usePref<string>('compact', typeof window !== 'undefined' && window.innerWidth < 1900 ? 'yes' : 'no');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const win = useWindow(b, weeks, group, filter, search);
  if (!b) return null;

  const dayW = weeks === 3 ? 30 : weeks === 4 ? 23 : 15;
  const days = weeks * 7;
  const todayIdx = diffDays(win.start, b.today);
  const staleCutoff = addDays(b.today, -STALE_DAYS);
  const memberName = (id: string | null) => (id ? L.member.get(id)?.name ?? '—' : null);
  const otherDims = (['area', 'system', 'trade'] as Group[]).filter((g) => g !== group);
  const full = compact !== 'yes';
  const total = [...win.groups].reduce((n, [, xs]) => n + xs.length, 0);
  const counts = { ready: 0, constrained: 0, at_risk: 0 } as Record<Readiness, number>;
  for (const [, xs] of win.groups) for (const a of xs) counts[b.readiness[a.id].state]++;

  const move = async (a: Activity, delta: number) => {
    if (!delta) return;
    await run(`/activities/${a.id}`, { plannedStart: addDays(a.plannedStart, delta), plannedFinish: addDays(a.plannedFinish, delta) }, 'PATCH', `Moved to ${fmtRange(addDays(a.plannedStart, delta), addDays(a.plannedFinish, delta))}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={String(weeks)} onChange={(v) => setWeeks(Number(v))} tabs={[{ value: '3', label: '3 weeks · make-ready' }, { value: '4', label: '4 weeks' }, { value: '6', label: '6 weeks · lookahead' }]} />
        <Tabs value={group} onChange={setGroup} tabs={[{ value: 'area', label: 'By area' }, { value: 'system', label: 'By system' }, { value: 'trade', label: 'By trade' }]} />
        <Select className="!w-40" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All activities</option>
          <option value="not_ready">Not READY</option>
          <option value="at_risk">AT RISK only</option>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="!w-52 pl-7" placeholder="Search activity or trade" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={!full} onChange={(e) => setCompact(e.target.checked ? 'yes' : 'no')} /> Compact
        </label>
        <div className="ml-auto flex gap-2">
          <Link to={`/p/${b.project.id}/print/board?weeks=${weeks}&group=${group}`} target="_blank">
            <Button><Printer className="h-4 w-4" /> Print</Button>
          </Link>
          {L.isSuper && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Activity
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        <span><b>{total}</b> activities in window</span>
        <span className="text-ready-700"><b>{counts.ready}</b> READY</span>
        <span className="text-constrained-700"><b>{counts.constrained}</b> CONSTRAINED</span>
        <span className="text-risk-700"><b>{counts.at_risk}</b> AT RISK</span>
        {L.isSuper && <span className="text-slate-400">Drag a bar to reschedule. Changes are logged.</span>}
      </div>

      {total === 0 ? (
        <Empty title="Nothing in this window">{L.isSuper ? <>Add activities, or <Link className="underline" to={`/p/${b.project.id}/import`}>import a P6 export, CSV, or a pre-commissioning template</Link>.</> : 'No activities match.'}</Empty>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm" style={{ maxHeight: 'calc(100vh - 210px)' }}>
          <table className="border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-white">
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th rowSpan={2} className="sticky left-0 z-30 min-w-[260px] border-b border-r bg-white px-3 py-2">Activity</th>
                {full && otherDims.map((g) => <th key={g} rowSpan={2} className="min-w-[110px] border-b px-2">{g === 'area' ? 'Area / zone' : g}</th>)}
                {full && <th rowSpan={2} className="border-b px-2">Crew</th>}
                <th rowSpan={2} className="min-w-[110px] border-b px-2">Start / finish</th>
                {full && <th rowSpan={2} className="border-b px-2" title="Predecessors">Pred</th>}
                <th rowSpan={2} className="border-b px-2">Readiness</th>
                <th rowSpan={2} className="min-w-[220px] border-b px-2">Top constraint</th>
                <th rowSpan={2} className="min-w-[100px] border-b px-2">Owner</th>
                <th rowSpan={2} className="border-b border-r px-2">Needed-by</th>
                {Array.from({ length: weeks }, (_, w) => (
                  <th key={w} colSpan={7} className={clsx('border-b border-l px-2 py-1 text-center normal-case', w === 0 ? 'bg-ink-900 text-white' : w < 3 ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-500')} style={{ minWidth: dayW * 7 }}>
                    <div className="text-[11px] font-bold uppercase tracking-wide">Wk {w + 1} · {LENS[w]}</div>
                    <div className="text-xs font-normal">{fmtDate(addDays(win.start, w * 7))}</div>
                  </th>
                ))}
              </tr>
              <tr>
                {Array.from({ length: days }, (_, i) => {
                  const d = addDays(win.start, i);
                  return (
                    <th key={i} className={clsx('border-b py-0.5 text-center text-[10px] font-medium', i % 7 === 0 && 'border-l', !isWorkDay(d, b.project.workDays) && 'bg-slate-100 text-slate-400', i === todayIdx && 'bg-brand-400 text-ink-900')} style={{ width: dayW, minWidth: dayW }}>
                      {weeks <= 4 ? DOW1[new Date(d + 'T00:00:00Z').getUTCDay()] : ''}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {win.groups.map(([name, rows]) => (
                <GroupRows key={name} name={name} rows={rows} colSpanLeft={full ? 8 + otherDims.length : 6} days={days}>
                  {rows.map((a) => {
                    const r = b.readiness[a.id];
                    const top = r.topConstraintId ? L.constraint.get(r.topConstraintId) : undefined;
                    const stale = !a.actualFinish && a.updatedAt.slice(0, 10) < staleCutoff;
                    const done = !!a.actualFinish;
                    return (
                      <tr key={a.id} className={clsx('group', stale && 'bg-brand-50', done && 'opacity-50')}>
                        <td className={clsx('sticky left-0 z-10 border-b border-r px-3 py-1.5', stale ? 'bg-brand-50' : 'bg-white group-hover:bg-slate-50')}>
                          <button onClick={() => drawers.openActivity(a.id)} className="text-left font-medium leading-snug hover:underline">
                            {shortName(a, L)}
                          </button>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            {!full && a.systemId && group !== 'system' && <span className="truncate">{L.system.get(a.systemId)?.name}</span>}
                            {a.cxLevel && <span className="font-semibold text-slate-600">L{a.cxLevel}</span>}
                            {stale && <span className="flex items-center gap-0.5 font-medium text-brand-700"><Clock className="h-3 w-3" /> not updated {diffDays(a.updatedAt.slice(0, 10), b.today)}d</span>}
                            {r.overridden && <span className="font-medium text-brand-700">override</span>}
                            {done && <span>done</span>}
                          </div>
                        </td>
                        {full && otherDims.map((g) => <td key={g} className="border-b px-2 text-slate-600">{groupKey(b, a, g, L).replace(/^No .*/, '—')}</td>)}
                        {full && <td className="border-b px-2 text-center tabular-nums">{a.crewSize ?? '—'}</td>}
                        <td className="whitespace-nowrap border-b px-2 tabular-nums">{fmtRange(a.plannedStart, a.plannedFinish)}</td>
                        {full && <td className="border-b px-2 text-center" title={a.predecessorIds.map((p) => L.activity.get(p)?.name).join('\n')}>{a.predecessorIds.length || ''}</td>}
                        <td className="border-b px-2"><ReadinessBadge state={r.state} overridden={r.overridden} /></td>
                        <td className="max-w-[260px] border-b px-2">
                          {top ? (
                            <button className="line-clamp-2 text-left hover:underline" onClick={() => drawers.openConstraint(top.id)}>
                              <span className="text-slate-400">#{top.number}</span> {top.description}
                            </button>
                          ) : r.reasons[0] ? (
                            <span className="line-clamp-2 text-slate-600">{r.reasons[0].text}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="border-b px-2">{top ? memberName(top.ownerUserId) ?? <b className="text-risk-700">No owner</b> : ''}</td>
                        <td className={clsx('whitespace-nowrap border-b border-r px-2 tabular-nums', top?.neededBy && top.neededBy < b.today && 'font-bold text-risk-700')}>{top ? fmtDate(top.neededBy) : ''}</td>
                        <td colSpan={days} className="relative border-b p-0" style={{ height: 44 }}>
                          <Grid days={days} dayW={dayW} todayIdx={todayIdx} start={win.start} workDays={b.project.workDays} />
                          <Bar a={a} winStart={win.start} days={days} dayW={dayW} state={r.state} draggable={L.isSuper && !done} onMove={(d) => move(a, d)} onOpen={() => drawers.openActivity(a.id)} />
                        </td>
                      </tr>
                    );
                  })}
                </GroupRows>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {drawers.element}
      {adding && <AddActivity onClose={() => setAdding(false)} />}
    </div>
  );
}

function GroupRows({ name, rows, colSpanLeft, days, children }: { name: string; rows: Activity[]; colSpanLeft: number; days: number; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={colSpanLeft + days} className="sticky left-0 border-b bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          {name} <span className="font-normal text-slate-500">· {rows.length}</span>
        </td>
      </tr>
      {children}
    </>
  );
}

function Grid({ days, dayW, todayIdx, start, workDays }: { days: number; dayW: number; todayIdx: number; start: string; workDays: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex">
      {Array.from({ length: days }, (_, i) => (
        <div key={i} className={clsx('h-full', i % 7 === 0 && 'border-l border-slate-200', !isWorkDay(addDays(start, i), workDays) && 'bg-slate-50', i === todayIdx && 'bg-brand-100')} style={{ width: dayW, minWidth: dayW }} />
      ))}
    </div>
  );
}

function Bar({ a, winStart, days, dayW, state, draggable, onMove, onOpen }: { a: Activity; winStart: string; days: number; dayW: number; state: Readiness; draggable: boolean; onMove: (delta: number) => void; onOpen: () => void }) {
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const s = diffDays(winStart, a.plannedStart);
  const e = diffDays(winStart, a.plannedFinish);
  const left = Math.max(0, s);
  const right = Math.min(days - 1, e);
  if (right < 0 || left > days - 1) return null;
  const delta = Math.round(dx / dayW);
  return (
    <div
      role="button"
      title={`${a.name}\n${fmtRange(a.plannedStart, a.plannedFinish)}${draggable ? '\nDrag to reschedule' : ''}`}
      className={clsx('absolute top-2 flex h-7 select-none items-center overflow-hidden rounded border px-1.5 text-[11px] font-bold shadow-sm', BAR[state], draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer', s < 0 && 'rounded-l-none border-l-0', e > days - 1 && 'rounded-r-none border-r-0')}
      style={{ left: left * dayW + 1, width: (right - left + 1) * dayW - 2, transform: dx ? `translateX(${delta * dayW}px)` : undefined, zIndex: dx ? 5 : 1, touchAction: 'none' }}
      onPointerDown={(ev) => {
        if (!draggable) return;
        (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
        drag.current = { x: ev.clientX, moved: false };
      }}
      onPointerMove={(ev) => {
        if (!drag.current) return;
        const d = ev.clientX - drag.current.x;
        if (Math.abs(d) > 3) drag.current.moved = true;
        setDx(d);
      }}
      onPointerUp={() => {
        const moved = drag.current?.moved;
        drag.current = null;
        setDx(0);
        if (moved) onMove(delta);
        else onOpen();
      }}
      onClick={() => !draggable && onOpen()}
    >
      {dx !== 0 && delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}d` : a.crewSize ? `${a.crewSize}` : ''}
    </div>
  );
}

function AddActivity({ onClose }: { onClose: () => void }) {
  const { data: b } = useBundle();
  const { run, pending } = useAct();
  const start = b ? b.today : '';
  const [f, setF] = useState({ name: '', areaId: '', systemId: '', tradeId: '', plannedStart: start, plannedFinish: start, crewSize: '', cxLevel: '' });
  if (!b) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="New activity"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!f.name.trim() || !f.plannedStart || !f.plannedFinish}
            onClick={async () => {
              await run(`/projects/${b.project.id}/activities`, {
                name: f.name.trim(), areaId: f.areaId || null, systemId: f.systemId || null, tradeId: f.tradeId || null, plannedStart: f.plannedStart, plannedFinish: f.plannedFinish,
                crewSize: f.crewSize ? Number(f.crewSize) : null, cxLevel: f.cxLevel ? Number(f.cxLevel) : null,
              }, 'POST', 'Activity added');
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Activity" className="col-span-2"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Start"><Input type="date" value={f.plannedStart} onChange={(e) => setF({ ...f, plannedStart: e.target.value, plannedFinish: f.plannedFinish < e.target.value ? e.target.value : f.plannedFinish })} /></Field>
        <Field label="Finish"><Input type="date" value={f.plannedFinish} onChange={(e) => setF({ ...f, plannedFinish: e.target.value })} /></Field>
        <Field label="Area / zone"><Select value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value })}><option value="">—</option>{b.areas.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
        <Field label="System"><Select value={f.systemId} onChange={(e) => setF({ ...f, systemId: e.target.value })}><option value="">—</option>{b.systems.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
        <Field label="Trade"><Select value={f.tradeId} onChange={(e) => setF({ ...f, tradeId: e.target.value })}><option value="">—</option>{b.trades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
        <Field label="Crew size"><Input type="number" min={0} value={f.crewSize} onChange={(e) => setF({ ...f, crewSize: e.target.value })} /></Field>
        <Field label="Commissioning level" className="col-span-2"><Select value={f.cxLevel} onChange={(e) => setF({ ...f, cxLevel: e.target.value })}><option value="">—</option>{[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>L{l}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}
