// FR-12 print for the wall: 11x17 landscape, large type, readiness as words + symbols (no colour dependence).
import { useSearchParams } from 'react-router-dom';
import { addDays, diffDays, CATEGORY_LABELS, READINESS_LABELS, STATUS_LABELS, type Readiness } from '@lookahead/shared';
import { useBundle, useLookups } from '../lib/hooks';
import { fmtDate, fmtRange } from '../lib/format';
import { Button, Spinner } from '../components/ui';
import { DOW1, LENS, shortName, useWindow } from './Board';

const SYMBOL: Record<Readiness, string> = { ready: '✓', constrained: '!', at_risk: '✕' };

function Header({ title }: { title: string }) {
  const { data: b } = useBundle();
  if (!b) return null;
  return (
    <div className="mb-3 flex items-end justify-between border-b-4 border-black pb-2">
      <div>
        <div className="text-sm font-bold uppercase tracking-widest">{b.project.name}</div>
        <h1 className="text-3xl font-black">{title}</h1>
      </div>
      <div className="text-right text-sm">
        Printed {fmtDate(b.today, true)} · Legend: ✓ READY · ! CONSTRAINED · ✕ AT RISK
        <div className="no-print mt-1"><Button variant="dark" onClick={() => window.print()}>Print</Button></div>
      </div>
    </div>
  );
}

export function PrintBoardPage() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const [params] = useSearchParams();
  const weeks = Number(params.get('weeks') ?? 3);
  const group = (params.get('group') ?? 'area') as 'area' | 'system' | 'trade';
  const win = useWindow(b, weeks, group);
  if (!b) return <Spinner />;
  const days = weeks * 7;
  return (
    <div className="bg-white p-6 text-black">
      <Header title={`${weeks}-week lookahead · ${fmtRange(win.start, win.end)}`} />
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="border-2 border-black px-2 py-1 text-left">Activity</th>
            <th className="border-2 border-black px-1">Trade</th>
            <th className="border-2 border-black px-1">Crew</th>
            <th className="border-2 border-black px-1">Readiness</th>
            <th className="border-2 border-black px-1 text-left">Top constraint · owner · needed-by</th>
            {Array.from({ length: weeks }, (_, w) => (
              <th key={w} colSpan={7} className="border-2 border-black px-1 text-center">Wk {w + 1} {LENS[w]}<br /><span className="font-normal">{fmtDate(addDays(win.start, w * 7))}</span></th>
            ))}
          </tr>
          <tr>
            <th colSpan={5} />
            {Array.from({ length: days }, (_, i) => <th key={i} className="border border-black text-[10px] font-normal">{DOW1[new Date(addDays(win.start, i) + 'T00:00:00Z').getUTCDay()]}</th>)}
          </tr>
        </thead>
        <tbody>
          {win.groups.map(([name, rows]) => [
            <tr key={name}><td colSpan={5 + days} className="border-2 border-black bg-gray-200 px-2 py-1 font-bold uppercase">{name}</td></tr>,
            ...rows.map((a) => {
              const r = b.readiness[a.id];
              const top = r.topConstraintId ? L.constraint.get(r.topConstraintId) : undefined;
              const s = diffDays(win.start, a.plannedStart);
              const e = diffDays(win.start, a.plannedFinish);
              return (
                <tr key={a.id} className="break-inside-avoid">
                  <td className="border border-black px-2 py-1 font-semibold">{shortName(a, L)}<div className="text-[11px] font-normal">{L.system.get(a.systemId ?? '')?.name}</div></td>
                  <td className="border border-black px-1">{L.trade.get(a.tradeId ?? '')?.name ?? ''}</td>
                  <td className="border border-black px-1 text-center">{a.crewSize ?? ''}</td>
                  <td className="whitespace-nowrap border border-black px-1 font-bold">{SYMBOL[r.state]} {READINESS_LABELS[r.state]}</td>
                  <td className="border border-black px-1">{top ? `#${top.number} ${top.description} · ${L.member.get(top.ownerUserId ?? '')?.name ?? 'NO OWNER'} · ${fmtDate(top.neededBy)}` : r.reasons[0]?.text ?? ''}</td>
                  {Array.from({ length: days }, (_, i) => (
                    <td key={i} className="border border-gray-400 p-0 text-center text-[11px] font-bold" style={{ width: 22 }}>
                      {i >= s && i <= e ? <div className={r.state === 'ready' ? 'bg-black text-white' : r.state === 'at_risk' ? 'bg-[repeating-linear-gradient(45deg,#000_0,#000_2px,#fff_2px,#fff_5px)]' : 'bg-gray-300'}>{i === Math.max(0, s) ? SYMBOL[r.state] : ' '}</div> : null}
                    </td>
                  ))}
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
    </div>
  );
}

export function PrintConstraintsPage() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  if (!b) return <Spinner />;
  const rows = b.constraints.filter((c) => c.status !== 'cleared').sort((x, y) => (x.neededBy ?? '').localeCompare(y.neededBy ?? ''));
  return (
    <div className="bg-white p-6 text-black">
      <Header title={`Constraint log · ${rows.length} not cleared`} />
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr>{['#', 'Constraint', 'Category', 'Blocks', 'Owner', 'Needed-by', 'Promised', 'Status'].map((h) => <th key={h} className="border-2 border-black px-2 py-1 text-left">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const over = c.neededBy && c.neededBy < b.today;
            return (
              <tr key={c.id} className="break-inside-avoid">
                <td className="border border-black px-2 py-1">{c.number}</td>
                <td className="border border-black px-2 font-semibold">{c.description}</td>
                <td className="border border-black px-2">{CATEGORY_LABELS[c.category]}</td>
                <td className="border border-black px-2">{L.activity.get(c.activityId ?? '')?.name ?? L.milestone.get(c.milestoneId ?? '')?.name ?? ''}</td>
                <td className="border border-black px-2 font-semibold">{L.member.get(c.ownerUserId ?? '')?.name ?? 'NO OWNER'}</td>
                <td className="border border-black px-2 font-semibold">{fmtDate(c.neededBy)}{over ? ' ✕ OVERDUE' : ''}</td>
                <td className="border border-black px-2">{fmtDate(c.promisedDate)}</td>
                <td className="border border-black px-2 font-bold uppercase">{STATUS_LABELS[c.status]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
