// §9 commissioning readiness: systems × L1–L5, energization gates with named authoriser.
import { useState } from 'react';
import { Plus, ShieldCheck, Zap } from 'lucide-react';
import { CX_LEVEL_LABELS, SYSTEM_TYPE_LABELS, worst, type Milestone, type Readiness } from '@lookahead/shared';
import { useAct, useBundle, useLookups } from '../lib/hooks';
import { fmtDate } from '../lib/format';
import { Badge, Button, Card, Empty, ReadinessBadge, StatusBadge, clsx } from '../components/ui';
import { ConstraintForm } from '../components/ConstraintForm';
import { useDrawers } from '../components/Drawers';

export function CommissioningPage() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const drawers = useDrawers();
  if (!b) return null;
  const gates = b.milestones.filter((m) => m.kind === 'energization');
  const targets = b.milestones.filter((m) => m.kind !== 'energization');

  return (
    <div className="space-y-5">
      <Card title="Readiness by system and level" bodyClass="p-0">
        {b.systems.length === 0 ? (
          <div className="p-4"><Empty title="No systems yet">Add systems under Setup, then apply a pre-commissioning template.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">System</th>
                  {[1, 2, 3, 4, 5].map((l) => <th key={l} className="px-3 py-2" title={CX_LEVEL_LABELS[l]}>{CX_LEVEL_LABELS[l].split(' · ')[0]} <span className="font-normal normal-case">{CX_LEVEL_LABELS[l].split(' · ')[1]}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {b.systems.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-slate-500">{SYSTEM_TYPE_LABELS[s.systemType]}</div>
                    </td>
                    {[1, 2, 3, 4, 5].map((l) => {
                      const acts = b.activities.filter((a) => a.systemId === s.id && a.cxLevel === l);
                      const ms = targets.filter((m) => m.systemId === s.id && m.cxLevel === l);
                      if (!acts.length && !ms.length) return <td key={l} className="px-3 py-3 text-slate-300">—</td>;
                      const done = acts.filter((a) => a.actualFinish).length;
                      const open = acts.filter((a) => !a.actualFinish);
                      const state = open.reduce<Readiness>((m, a) => worst(m, b.readiness[a.id].state), 'ready');
                      return (
                        <td key={l} className="px-3 py-3">
                          {acts.length > 0 && (
                            <div className="space-y-1">
                              {open.length ? <ReadinessBadge state={state} /> : <Badge tone="green">Complete</Badge>}
                              <div className="text-xs text-slate-500">{done}/{acts.length} activities done</div>
                              {open.slice(0, 2).map((a) => (
                                <button key={a.id} className="block text-left text-xs hover:underline" onClick={() => drawers.openActivity(a.id)}>{a.name.split(' · ')[0]}</button>
                              ))}
                            </div>
                          )}
                          {ms.map((m) => (
                            <div key={m.id} className="mt-1 text-xs">
                              <span className="font-semibold">Target {fmtDate(m.targetDate)}</span>
                              {m.forecastDate && m.forecastDate !== m.targetDate && <span className={clsx('ml-1', m.forecastDate > (m.targetDate ?? '') ? 'text-risk-700' : 'text-ready-700')}>forecast {fmtDate(m.forecastDate)}</span>}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Zap className="h-5 w-5 text-brand-500" /> Energization gates</h2>
        <p className="mb-3 text-sm text-slate-600">No linked L3 activity can be READY until its gate is cleared: every gate constraint cleared and signed off by the named authoriser.</p>
        {gates.length === 0 ? <Empty title="No energization events yet">Applying the UPS or switchgear template adds one.</Empty> : (
          <div className="grid gap-4 lg:grid-cols-2">{gates.map((m) => <Gate key={m.id} m={m} onOpenConstraint={drawers.openConstraint} />)}</div>
        )}
      </div>
      {drawers.element}
    </div>
  );
}

function Gate({ m, onOpenConstraint }: { m: Milestone; onOpenConstraint: (id: string) => void }) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { run, pending } = useAct();
  const [adding, setAdding] = useState(false);
  if (!b) return null;
  const g = b.gates[m.id];
  const cs = b.constraints.filter((c) => c.milestoneId === m.id);
  const blocked = b.activities.filter((a) => m.activityIds.includes(a.id) && (a.cxLevel ?? 0) >= 3 && !a.actualFinish);
  return (
    <Card
      title={<span className="flex items-center gap-2">{m.name} {g?.cleared ? <Badge tone="green">Gate cleared</Badge> : g?.atRisk ? <Badge tone="red">At risk</Badge> : <Badge tone="amber">Not cleared</Badge>}</span>}
      actions={<span className="text-sm text-slate-500">Target {fmtDate(m.targetDate)}</span>}
    >
      <ul className="divide-y rounded-md border">
        {cs.map((c) => (
          <li key={c.id}>
            <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onOpenConstraint(c.id)}>
              <span>
                {c.description.replace(/ — .*$/, '')}
                <span className="block text-xs text-slate-500">{L.member.get(c.ownerUserId ?? '')?.name ?? 'No owner'} · needed {fmtDate(c.neededBy)}</span>
              </span>
              <StatusBadge status={c.status} />
            </button>
          </li>
        ))}
        {cs.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No gate items.</li>}
      </ul>
      {L.isSuper && (adding ? <div className="mt-2"><ConstraintForm milestoneId={m.id} onDone={() => setAdding(false)} /></div> : <Button size="sm" variant="ghost" className="mt-1" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Gate item</Button>)}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <span>
          Authoriser: <b>{L.member.get(m.authoriserUserId ?? '')?.name ?? 'not named'}</b>
          {m.gateConfirmedAt && <span className="text-ready-700"> · signed {fmtDate(m.gateConfirmedAt.slice(0, 10))} by {L.member.get(m.gateConfirmedBy ?? '')?.name}</span>}
        </span>
        {L.canConfirmGate && (
          m.gateConfirmedAt ? (
            <Button size="sm" loading={pending} onClick={() => run(`/milestones/${m.id}/confirm-gate`, { confirmed: false }, 'POST', 'Sign-off withdrawn')}>Withdraw sign-off</Button>
          ) : (
            <Button size="sm" variant="primary" loading={pending} disabled={(g?.openConstraintIds.length ?? 0) > 0} title={(g?.openConstraintIds.length ?? 0) > 0 ? 'Clear all gate items first' : undefined} onClick={() => run(`/milestones/${m.id}/confirm-gate`, { confirmed: true }, 'POST', 'Gate signed off')}>
              <ShieldCheck className="h-4 w-4" /> Sign off gate
            </Button>
          )
        )}
      </div>
      {blocked.length > 0 && (
        <div className="mt-3 text-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">L3 work behind this gate</div>
          <ul className="mt-1 space-y-1">
            {blocked.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span>{a.name.split(' · ')[0]} · {fmtDate(a.plannedStart)}</span><ReadinessBadge state={b.readiness[a.id].state} /></li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}
