import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarRange, ChevronLeft, Clock, LogOut, RotateCw } from 'lucide-react';
import { addDays, ROLE_LABELS, STALE_DAYS, VARIANCE_LABELS, weekStart, type Notification } from '@lookahead/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAct, useBundle, usePid } from '../lib/hooks';
import { fmtDate, pct, timeAgo } from '../lib/format';
import { Button, Modal, Spinner, clsx } from './ui';
import { Logo } from './Logo';

const NAV = [
  { to: '', label: 'Board', end: true },
  { to: 'huddle', label: 'This Week' },
  { to: 'constraints', label: 'Constraints' },
  { to: 'plan', label: 'Weekly Plan' },
  { to: 'equipment', label: 'Equipment' },
  { to: 'commissioning', label: 'Commissioning' },
  { to: 'metrics', label: 'Metrics' },
  { to: 'import', label: 'Import', superOnly: true },
  { to: 'setup', label: 'Setup' },
];

export function ProjectLayout() {
  const pid = usePid();
  const { data: b, isLoading, error } = useBundle(pid);
  const loc = useLocation();
  const { me, signOut } = useAuth();
  const navigate = useNavigate();

  if (isLoading) return <Spinner label="Loading plan…" />;
  if (error || !b) return <div className="p-8 text-risk-700">Could not load this project. {(error as Error)?.message}</div>;
  if (b.myRole === 'owner_viewer' && loc.pathname === `/p/${pid}`) return <Navigate to={`/p/${pid}/metrics`} replace />;

  const huddle = loc.pathname.endsWith('/huddle');
  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print bg-ink-900 text-white">
        <div className="flex items-center gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2 text-white" title="All projects">
            <Logo />
          </Link>
          <ChevronLeft className="h-4 w-4 text-slate-500" />
          <div className="min-w-0">
            <div className="truncate font-semibold leading-tight">{b.project.name}</div>
            <div className="text-xs text-slate-400">
              {ROLE_LABELS[b.myRole]} · Today {fmtDate(b.today, true)}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsMenu pid={pid} />
            <span className="hidden px-2 text-sm text-slate-300 md:inline">{me?.user.name}</span>
            <button
              title="Sign out"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="rounded p-2 text-slate-300 hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3">
          {NAV.filter((n) => !n.superOnly || b.myRole === 'super').map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx('whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium', isActive ? 'bg-slate-50 text-ink-900' : 'text-slate-300 hover:bg-white/10 hover:text-white')
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {!huddle && <FreshnessBar />}
      <main className={clsx('flex-1', huddle ? '' : 'p-4')}>
        <Outlet />
      </main>
    </div>
  );
}

/** FR-13: the plan shows its own staleness and prompts the Monday roll-forward. */
function FreshnessBar() {
  const { data: b } = useBundle();
  const { run, pending } = useAct();
  const [result, setResult] = useState<any>(null);
  if (!b) return null;
  const thisWeek = weekStart(b.today);
  const windowEnd = addDays(thisWeek, 20);
  const live = b.activities.filter((a) => !a.actualFinish && a.plannedStart <= windowEnd && a.plannedFinish >= thisWeek);
  const lastUpdated = b.activities.reduce((m, a) => (a.updatedAt > m ? a.updatedAt : m), '');
  const cutoff = addDays(b.today, -STALE_DAYS);
  const stale = live.filter((a) => a.updatedAt.slice(0, 10) < cutoff).length;
  const needsRoll = !b.project.lastRolledWeek || b.project.lastRolledWeek < thisWeek;
  return (
    <>
      <div className={clsx('no-print flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-1.5 text-sm', needsRoll ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white')}>
        <span className="flex items-center gap-1.5 text-slate-600">
          <Clock className="h-4 w-4" /> Plan last updated <b>{timeAgo(lastUpdated)}</b>
        </span>
        {stale > 0 && (
          <span className="font-medium text-constrained-700">
            {stale} activit{stale === 1 ? 'y' : 'ies'} in the 3-week window not touched in {STALE_DAYS}+ days
          </span>
        )}
        {needsRoll && (
          <span className="ml-auto flex items-center gap-3">
            <span className="font-semibold text-brand-700">
              <CalendarRange className="mr-1 inline h-4 w-4" />
              New week ({fmtDate(thisWeek)}) — the plan hasn’t been rolled forward.
            </span>
            {b.myRole === 'super' && (
              <Button size="sm" variant="dark" loading={pending} onClick={async () => setResult(await run(`/projects/${b.project.id}/roll-forward`, {}))}>
                <RotateCw className="h-4 w-4" /> Roll forward
              </Button>
            )}
          </span>
        )}
      </div>
      <Modal open={!!result} onClose={() => setResult(null)} title={`Week of ${fmtDate(result?.week)} — rolled forward`} footer={<Button variant="primary" onClick={() => setResult(null)}>Done</Button>}>
        {result && (
          <div className="space-y-3 text-sm">
            <p>
              Last week’s PPC: <b className="text-2xl">{pct(result.lastWeek?.ppc)}</b> ({result.lastWeek?.done} of {result.lastWeek?.done + result.lastWeek?.notDone} committed tasks done)
            </p>
            {result.unmarked > 0 && <p className="text-constrained-700">{result.unmarked} committed task(s) from last week are not marked Done / Not Done yet — mark them in Weekly Plan.</p>}
            {result.variance?.length > 0 && (
              <div>
                <div className="font-semibold">Variance reasons</div>
                <ul className="mt-1 list-disc pl-5">
                  {result.variance.map((v: any) => (
                    <li key={v.reason}>
                      {VARIANCE_LABELS[v.reason as keyof typeof VARIANCE_LABELS]}: {v.count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-slate-600">Next: review Weeks 2–3 in the pull session, raise constraints, and commit next week’s plan.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function NotificationsMenu({ pid }: { pid: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data, refetch } = useQuery({ queryKey: ['notifications'], queryFn: () => api<Notification[]>('/notifications'), refetchInterval: 60_000 });
  const unread = (data ?? []).filter((n) => !n.readAt).length;
  const go = async (n: Notification) => {
    setOpen(false);
    await api('/notifications/read', { body: { ids: [n.id] } });
    refetch();
    const p = n.projectId ?? pid;
    if (n.entityType === 'constraint') navigate(`/p/${p}/constraints?c=${n.entityId}`);
    else if (n.entityType === 'equipment') navigate(`/p/${p}/equipment`);
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative rounded p-2 text-slate-300 hover:bg-white/10" title="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-ink-900">{unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-[22rem] max-w-[90vw] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  className="text-xs text-slate-500 hover:underline"
                  onClick={async () => {
                    await api('/notifications/read', { body: {} });
                    refetch();
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {(data ?? []).length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Nothing yet.</li>}
              {(data ?? []).map((n) => (
                <li key={n.id}>
                  <button onClick={() => go(n)} className={clsx('block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50', !n.readAt && 'bg-brand-50')}>
                    <div className="font-medium leading-snug">{n.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{timeAgo(n.createdAt)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
