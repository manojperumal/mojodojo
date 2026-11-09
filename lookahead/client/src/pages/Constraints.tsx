// FR-03 constraint log — one sortable list; PM / field engineer get it as their inbox.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Printer } from 'lucide-react';
import { CATEGORY_LABELS, CONSTRAINT_CATEGORIES, addDays, diffDays, weekStart, type Constraint } from '@lookahead/shared';
import { useAuth } from '../lib/auth';
import { useBundle, useLookups } from '../lib/hooks';
import { fmtDate, relDays } from '../lib/format';
import { Button, Empty, Modal, ReadinessBadge, Select, StatusBadge, clsx } from '../components/ui';
import { ConstraintForm } from '../components/ConstraintForm';
import { useDrawers } from '../components/Drawers';

type SortKey = 'number' | 'neededBy' | 'age' | 'owner' | 'category' | 'status' | 'activity';

export function ConstraintsPage() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { me } = useAuth();
  const drawers = useDrawers();
  const inboxRole = ['pm', 'field_engineer', 'cxa'].includes(L.role);
  const [owner, setOwner] = useState<string>(inboxRole ? 'me' : 'all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('active');
  const [week, setWeek] = useState('all');
  const [overdue, setOverdue] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'neededBy', dir: 1 });
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    if (!b) return [];
    const ownerName = (c: Constraint) => (c.ownerUserId ? L.member.get(c.ownerUserId)?.name ?? '' : '');
    const age = (c: Constraint) => diffDays(c.raisedAt.slice(0, 10), c.clearedAt?.slice(0, 10) ?? b.today);
    const actName = (c: Constraint) => (c.activityId ? L.activity.get(c.activityId)?.name : c.milestoneId ? L.milestone.get(c.milestoneId)?.name : '') ?? '';
    const xs = b.constraints
      .filter((c) => owner === 'all' || (owner === 'me' ? c.ownerUserId === me?.user.id : owner === 'none' ? !c.ownerUserId : c.ownerUserId === owner))
      .filter((c) => category === 'all' || c.category === category)
      .filter((c) => status === 'all' || (status === 'active' ? c.status !== 'cleared' : c.status === status))
      .filter((c) => week === 'all' || (c.neededBy && weekStart(c.neededBy) === week))
      .filter((c) => !overdue || (c.status !== 'cleared' && c.neededBy && c.neededBy < b.today));
    const val = (c: Constraint): string | number => {
      switch (sort.key) {
        case 'number': return c.number;
        case 'neededBy': return c.neededBy ?? '0000';
        case 'age': return age(c);
        case 'owner': return ownerName(c);
        case 'category': return CATEGORY_LABELS[c.category];
        case 'status': return ['raised', 'missed', 'open', 'promised', 'cleared'].indexOf(c.status);
        case 'activity': return actName(c);
      }
    };
    return xs.sort((x, y) => (val(x) < val(y) ? -1 : val(x) > val(y) ? 1 : 0) * sort.dir).map((c) => ({ c, age: age(c), owner: ownerName(c), act: actName(c) }));
  }, [b, L, owner, category, status, week, overdue, sort, me]);

  if (!b) return null;
  const thisWeek = weekStart(b.today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, (i - 1) * 7));
  const raisedCount = b.constraints.filter((c) => c.status === 'raised').length;
  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={clsx('cursor-pointer select-none whitespace-nowrap px-3 py-2 hover:text-slate-800', className)} onClick={() => setSort({ key: k, dir: sort.key === k ? ((-sort.dir) as 1 | -1) : 1 })}>
      {children} {sort.key === k && (sort.dir === 1 ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select className="!w-48" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="all">All owners</option>
          <option value="me">My constraints</option>
          <option value="none">No owner ({raisedCount})</option>
          {b.members.filter((m) => m.role !== 'owner_viewer').map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </Select>
        <Select className="!w-52" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {CONSTRAINT_CATEGORIES.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
        </Select>
        <Select className="!w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Not cleared</option>
          <option value="all">All statuses</option>
          <option value="raised">Raised (needs owner)</option>
          <option value="open">Open</option>
          <option value="promised">Promised</option>
          <option value="missed">Missed</option>
          <option value="cleared">Cleared</option>
        </Select>
        <Select className="!w-48" value={week} onChange={(e) => setWeek(e.target.value)}>
          <option value="all">Needed any week</option>
          {weeks.map((w) => <option key={w} value={w}>Needed wk of {fmtDate(w)}{w === thisWeek ? ' (this week)' : ''}</option>)}
        </Select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> Overdue only</label>
        <div className="ml-auto flex gap-2">
          <Link to={`/p/${b.project.id}/print/constraints`} target="_blank"><Button><Printer className="h-4 w-4" /> Print</Button></Link>
          {L.canCreateConstraint && <Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Constraint</Button>}
        </div>
      </div>
      {raisedCount > 0 && L.isSuper && owner !== 'none' && (
        <button onClick={() => { setOwner('none'); setStatus('active'); }} className="w-full rounded-md border border-risk-600/40 bg-risk-50 px-3 py-2 text-left text-sm font-medium text-risk-700">
          {raisedCount} constraint{raisedCount > 1 ? 's' : ''} raised by foremen need an owner and needed-by date →
        </button>
      )}
      {rows.length === 0 ? (
        <Empty title={owner === 'me' ? 'Nothing in your inbox' : 'No constraints match'}>{owner === 'me' ? 'Constraints you own will show up here.' : 'Try clearing a filter.'}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <Th k="number">#</Th>
                <th className="px-3 py-2">Constraint</th>
                <Th k="category">Category</Th>
                <Th k="activity">Blocks</Th>
                <Th k="owner">Owner</Th>
                <Th k="neededBy">Needed-by</Th>
                <th className="px-3 py-2">Promised</th>
                <Th k="age" className="text-right">Age</Th>
                <Th k="status">Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, age, owner: on, act }) => {
                const over = c.status !== 'cleared' && c.neededBy && c.neededBy < b.today;
                const a = c.activityId ? L.activity.get(c.activityId) : undefined;
                return (
                  <tr key={c.id} onClick={() => drawers.openConstraint(c.id)} className={clsx('cursor-pointer border-b last:border-0 hover:bg-slate-50', c.status === 'raised' && 'bg-risk-50/60')}>
                    <td className="px-3 py-2 tabular-nums text-slate-500">{c.number}</td>
                    <td className="max-w-md px-3 py-2 font-medium">{c.description}{c.refNumber && <span className="ml-1 text-xs text-slate-500">{c.refNumber}</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{CATEGORY_LABELS[c.category]}</td>
                    <td className="max-w-xs px-3 py-2">
                      <span className="line-clamp-1">{act || '—'}</span>
                      {a && <span className="mt-0.5 block"><ReadinessBadge state={b.readiness[a.id]?.state ?? 'ready'} /></span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{on || <b className="text-risk-700">No owner</b>}</td>
                    <td className={clsx('whitespace-nowrap px-3 py-2 tabular-nums', over && 'font-bold text-risk-700')}>
                      {c.neededBy ? <>{fmtDate(c.neededBy)} <span className="text-xs font-normal text-slate-500">{relDays(c.neededBy, b.today)}</span></> : <b className="text-risk-700">No date</b>}
                    </td>
                    <td className={clsx('whitespace-nowrap px-3 py-2 tabular-nums', c.promisedDate && c.neededBy && c.promisedDate > c.neededBy && 'font-bold text-risk-700')}>{fmtDate(c.promisedDate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{age}d</td>
                    <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Log a constraint" width="max-w-xl">
        <ConstraintForm onDone={() => setAdding(false)} />
      </Modal>
      {drawers.element}
    </div>
  );
}
