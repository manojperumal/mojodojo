// FR-08 Weekly Work Plan + foreman confirm links, FR-09 Done / Not Done and PPC.
import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Link2, Mail, Trash2, X } from 'lucide-react';
import { VARIANCE_LABELS, VARIANCE_REASONS, addDays, ppcByWeek, weekStart, type Commitment, type VarianceReason } from '@lookahead/shared';
import { useAct, useBundle, useLookups } from '../lib/hooks';
import { fmtDate, fmtRange, pct } from '../lib/format';
import { Badge, Button, Card, Empty, Input, Modal, ReadinessBadge, Select, Stat, clsx, toast } from '../components/ui';
import { useDrawers } from '../components/Drawers';

export function WeeklyPlanPage() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { run, pending } = useAct();
  const drawers = useDrawers();
  const thisWeek = b ? weekStart(b.today) : '';
  const [week, setWeek] = useState<string | null>(null);
  const ws = week ?? thisWeek;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [link, setLink] = useState<{ trade: string; url: string; email: string | null; tradeId: string } | null>(null);

  const data = useMemo(() => {
    if (!b) return null;
    const we = addDays(ws, 6);
    const planned = b.commitments.filter((c) => c.weekStart === ws);
    const committedIds = new Set(planned.map((c) => c.taskId));
    const candidates = b.tasks
      .filter((t) => t.plannedStart <= we && t.plannedFinish >= ws && !committedIds.has(t.id))
      .filter((t) => !L.activity.get(t.activityId)?.actualFinish)
      .sort((x, y) => x.plannedStart.localeCompare(y.plannedStart));
    const byTrade = new Map<string, Commitment[]>();
    for (const c of planned) {
      const k = c.tradeId ?? '';
      byTrade.set(k, [...(byTrade.get(k) ?? []), c]);
    }
    return { planned, candidates, byTrade: [...byTrade.entries()].sort((x, y) => (L.trade.get(x[0])?.name ?? '').localeCompare(L.trade.get(y[0])?.name ?? '')), ppc: ppcByWeek(b.commitments, [ws])[0] };
  }, [b, ws, L]);
  if (!b || !data) return null;

  const closed = ws < thisWeek;
  const ready = data.candidates.filter((t) => b.taskReadiness[t.id]?.state === 'ready');
  const notReady = data.candidates.filter((t) => b.taskReadiness[t.id]?.state !== 'ready');

  const makeLink = async (tradeId: string, send: boolean) => {
    const r = await run<{ url: string; sent: boolean }>(`/projects/${b.project.id}/foreman-links`, { tradeId, weekStart: ws, send }, 'POST', send ? 'Sent to the foreman' : undefined);
    const t = L.trade.get(tradeId)!;
    if (!send) setLink({ trade: t.name, url: r.url, email: t.foremanEmail, tradeId });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setWeek(addDays(ws, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-[13rem] text-center">
            <div className="text-lg font-bold">Week of {fmtDate(ws)}</div>
            <div className="text-xs text-slate-500">{ws === thisWeek ? 'This week' : ws === addDays(thisWeek, 7) ? 'Next week' : closed ? 'Past week' : 'Future week'}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setWeek(addDays(ws, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        {ws !== thisWeek && <Button size="sm" onClick={() => setWeek(null)}>This week</Button>}
        {ws !== addDays(thisWeek, 7) && <Button size="sm" onClick={() => setWeek(addDays(thisWeek, 7))}>Next week</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="PPC this week" value={pct(data.ppc.ppc)} sub={`${data.ppc.done} done · ${data.ppc.notDone} not done · ${data.ppc.pending} to mark`} tone={data.ppc.ppc == null ? undefined : data.ppc.ppc >= 0.8 ? 'good' : data.ppc.ppc >= 0.6 ? 'warn' : 'bad'} />
        <Stat label="Committed tasks" value={data.planned.length} sub={`${data.planned.filter((c) => c.status === 'proposed').length} awaiting foreman confirmation`} />
        <Stat label="READY, not yet committed" value={ready.length} />
        <Stat label="In week but not READY" value={notReady.length} tone={notReady.length ? 'warn' : undefined} sub="Clear constraints to pull these in" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <Card
          title="Pull into the plan"
          actions={L.isSuper && picked.size > 0 && (
            <Button size="sm" variant="primary" loading={pending} onClick={async () => { await run(`/projects/${b.project.id}/commitments`, { weekStart: ws, taskIds: [...picked] }, 'POST', `${picked.size} task(s) added to the plan`); setPicked(new Set()); }}>
              Add {picked.size} to plan
            </Button>
          )}
          bodyClass="p-0"
        >
          {data.candidates.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No other crew tasks fall in this week.</p>
          ) : (
            <ul className="divide-y">
              {[...ready, ...notReady].map((t) => {
                const r = b.taskReadiness[t.id];
                const ok = r?.state === 'ready';
                const a = L.activity.get(t.activityId)!;
                return (
                  <li key={t.id} className={clsx('flex items-start gap-3 px-4 py-2.5 text-sm', !ok && 'bg-slate-50')}>
                    <input type="checkbox" className="mt-1 h-4 w-4" disabled={!ok || !L.isSuper || closed} checked={picked.has(t.id)} onChange={(e) => { const n = new Set(picked); e.target.checked ? n.add(t.id) : n.delete(t.id); setPicked(n); }} />
                    <div className="min-w-0 flex-1">
                      <button className="text-left font-medium hover:underline" onClick={() => drawers.openActivity(a.id)}>{t.name}</button>
                      <div className="text-xs text-slate-500">{L.trade.get(t.tradeId ?? '')?.name ?? 'No trade'} · crew {t.crewSize ?? '—'} · {fmtRange(t.plannedStart, t.plannedFinish)}</div>
                      {!ok && r?.reasons[0] && <div className="mt-0.5 text-xs text-constrained-700">{r.reasons[0].text}{r.reasons.length > 1 ? ` (+${r.reasons.length - 1} more)` : ''}</div>}
                    </div>
                    <ReadinessBadge state={r?.state ?? 'ready'} overridden={r?.overridden} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-3">
          {data.byTrade.length === 0 && <Empty title="Nothing committed for this week yet">Pick READY tasks on the left, then send each foreman their confirm link.</Empty>}
          {data.byTrade.map(([tradeId, cs]) => {
            const t = L.trade.get(tradeId);
            const confirmed = cs.filter((c) => c.status !== 'proposed').length;
            return (
              <Card
                key={tradeId}
                title={<span>{t?.name ?? 'No trade'} <span className="font-normal text-slate-500">· {t?.foremanName ?? 'no foreman set'} · {confirmed}/{cs.length} confirmed</span></span>}
                actions={L.isSuper && t && !closed && (
                  <>
                    <Button size="sm" onClick={() => makeLink(t.id, false)}><Link2 className="h-4 w-4" /> Confirm link</Button>
                    {t.foremanEmail && <Button size="sm" onClick={() => makeLink(t.id, true)}><Mail className="h-4 w-4" /> Email foreman</Button>}
                  </>
                )}
                bodyClass="p-0"
              >
                <ul className="divide-y">
                  {cs.map((c) => <CommitmentRow key={c.id} c={c} onOpen={(id) => drawers.openActivity(id)} canMark={L.isSuper} />)}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>

      <Modal open={!!link} onClose={() => setLink(null)} title={`Confirm link — ${link?.trade}`} footer={<Button variant="primary" onClick={() => setLink(null)}>Done</Button>}>
        {link && (
          <div className="space-y-3 text-sm">
            <p>Send this to the foreman by text or email. They confirm crew and dates and can flag problems — no account needed. The link expires in 14 days.</p>
            <div className="flex gap-2">
              <Input readOnly value={link.url} onFocus={(e) => e.target.select()} />
              <Button onClick={() => { navigator.clipboard?.writeText(link.url); toast('Link copied'); }}><Copy className="h-4 w-4" /> Copy</Button>
            </div>
            {!link.email && <p className="text-slate-500">Add the foreman’s email under Setup → Trades to send it from here.</p>}
          </div>
        )}
      </Modal>
      {drawers.element}
    </div>
  );
}

function CommitmentRow({ c, onOpen, canMark }: { c: Commitment; onOpen: (activityId: string) => void; canMark: boolean }) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { run, pending } = useAct();
  const [missing, setMissing] = useState(false);
  const [reason, setReason] = useState<VarianceReason>('predecessor');
  const [note, setNote] = useState('');
  const t = L.task.get(c.taskId);
  if (!b || !t) return null;
  const set = (body: object, ok?: string) => run(`/commitments/${c.id}`, body, 'PATCH', ok);
  return (
    <li className="px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <button className="text-left font-medium hover:underline" onClick={() => onOpen(t.activityId)}>{t.name}</button>
          <div className="text-xs text-slate-500">
            crew {c.crewSize ?? '—'} · {fmtRange(c.promisedStart ?? t.plannedStart, c.promisedFinish ?? t.plannedFinish)}
            {c.confirmedByName && ` · confirmed by ${c.confirmedByName}`}
            {c.overridden && ' · committed on override'}
          </div>
        </div>
        {c.status === 'proposed' && <Badge tone="amber">Awaiting foreman</Badge>}
        {c.status === 'confirmed' && <Badge tone="blue">Committed</Badge>}
        {c.status === 'done' && <Badge tone="green"><Check className="h-3 w-3" /> Done</Badge>}
        {c.status === 'not_done' && <Badge tone="red"><X className="h-3 w-3" /> Not done · {c.varianceReason && VARIANCE_LABELS[c.varianceReason]}</Badge>}
        {canMark && (
          <div className="flex items-center gap-1">
            {c.status === 'proposed' && <Button size="sm" variant="ghost" loading={pending} onClick={() => set({ status: 'confirmed' }, 'Confirmed on behalf of the foreman')}>Confirm</Button>}
            {c.status !== 'proposed' && (
              <>
                <Button size="sm" variant={c.status === 'done' ? 'dark' : 'secondary'} onClick={() => set({ status: 'done' })} title="Done"><Check className="h-4 w-4" /> Done</Button>
                <Button size="sm" variant={c.status === 'not_done' ? 'danger' : 'secondary'} onClick={() => setMissing(true)} title="Not done"><X className="h-4 w-4" /> Not done</Button>
              </>
            )}
            {['proposed', 'confirmed'].includes(c.status) && <button className="ml-1 text-slate-400 hover:text-risk-600" title="Remove from plan" onClick={() => run(`/commitments/${c.id}`, undefined, 'DELETE')}><Trash2 className="h-4 w-4" /></button>}
          </div>
        )}
      </div>
      {missing && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-risk-50 p-2">
          <span className="text-sm font-medium">Why not done?</span>
          <Select className="!w-44" value={reason} onChange={(e) => setReason(e.target.value as VarianceReason)}>
            {VARIANCE_REASONS.map((r) => <option key={r} value={r}>{VARIANCE_LABELS[r]}</option>)}
          </Select>
          {reason === 'other' && <Input className="!w-60" placeholder="Note (required for Other)" value={note} onChange={(e) => setNote(e.target.value)} />}
          <Button size="sm" variant="danger" disabled={reason === 'other' && !note.trim()} onClick={async () => { await set({ status: 'not_done', varianceReason: reason, varianceNote: note || null }); setMissing(false); }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setMissing(false)}>Cancel</Button>
        </div>
      )}
    </li>
  );
}
