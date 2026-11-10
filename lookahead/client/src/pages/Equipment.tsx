// FR-07 long-lead and start-up-critical equipment tracker.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { diffDays, worst, type Equipment, type Readiness } from '@lookahead/shared';
import { useAct, useBundle, useLookups } from '../lib/hooks';
import { fmtDate } from '../lib/format';
import { Badge, Button, Empty, Field, Input, Modal, ReadinessBadge, Select, clsx } from '../components/ui';
import { useDrawers } from '../components/Drawers';

export function EquipmentPage() {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { run } = useAct();
  const drawers = useDrawers();
  const [adding, setAdding] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(true);
  if (!b) return null;
  const linked = (e: Equipment) => b.activities.filter((a) => a.equipmentIds.includes(e.id));
  const rows = b.equipment.filter((e) => !onlyOpen || !e.actualDelivery);
  const slip = (e: Equipment) => (e.promisedDelivery && e.requiredOnSite ? diffDays(e.requiredOnSite, e.promisedDelivery) : null);
  const save = (e: Equipment, k: keyof Equipment, v: string) => run(`/equipment/${e.id}`, { [k]: v || null }, 'PATCH', `${e.tag} updated`);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Not yet delivered only</label>
        <span className="text-sm text-slate-500">A promised date after required-on-site flags linked activities AT RISK.</span>
        {L.isSuper && <Button className="ml-auto" variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Equipment</Button>}
      </div>
      {rows.length === 0 ? (
        <Empty title="No equipment tracked">{L.isSuper ? 'Add long-lead items or import the equipment CSV.' : ''}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Tag</th>
                <th className="px-3 py-2">Description / vendor</th>
                <th className="px-3 py-2">System</th>
                <th className="px-3 py-2">Required on site</th>
                <th className="px-3 py-2">Promised</th>
                <th className="px-3 py-2">Actual</th>
                <th className="px-3 py-2">Slip</th>
                <th className="px-3 py-2">Needs</th>
                <th className="px-3 py-2">Linked work</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const s = slip(e);
                const acts = linked(e);
                const state = acts.reduce<Readiness>((m, a) => worst(m, b.readiness[a.id]?.state ?? 'ready'), 'ready');
                const late = !e.actualDelivery && s != null && s > 0;
                return (
                  <tr key={e.id} className={clsx('border-b last:border-0', late && 'bg-risk-50')}>
                    <td className="px-3 py-2 font-semibold">{e.tag}</td>
                    <td className="px-3 py-2">{e.description}<div className="text-xs text-slate-500">{e.vendor}</div></td>
                    <td className="px-3 py-2 text-slate-600">{L.system.get(e.systemId ?? '')?.name ?? '—'}</td>
                    <td className="px-3 py-2"><DateCell e={e} k="requiredOnSite" edit={L.canEditEquipment} save={save} /></td>
                    <td className="px-3 py-2"><DateCell e={e} k="promisedDelivery" edit={L.canEditEquipment} save={save} /></td>
                    <td className="px-3 py-2"><DateCell e={e} k="actualDelivery" edit={L.canEditEquipment} save={save} /></td>
                    <td className="px-3 py-2">{e.actualDelivery ? <Badge tone="green">On site</Badge> : s == null ? '—' : s > 0 ? <b className="text-risk-700">+{s}d late</b> : <span className="text-ready-700">{s === 0 ? 'on time' : `${-s}d early`}</span>}</td>
                    <td className="px-3 py-2 text-xs">{[e.startupNeeded && 'Start-up', e.witnessNeeded && 'Witness'].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-3 py-2">
                      {acts.length === 0 ? <span className="text-slate-400">—</span> : (
                        <div className="flex items-center gap-2">
                          <ReadinessBadge state={state} />
                          <button className="text-left text-xs hover:underline" onClick={() => drawers.openActivity(acts[0].id)}>{acts[0].name}{acts.length > 1 ? ` +${acts.length - 1}` : ''}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {adding && <AddEquipment onClose={() => setAdding(false)} />}
      {drawers.element}
    </div>
  );
}

function DateCell({ e, k, edit, save }: { e: Equipment; k: 'requiredOnSite' | 'promisedDelivery' | 'actualDelivery'; edit: boolean; save: (e: Equipment, k: keyof Equipment, v: string) => void }) {
  if (!edit) return <span className="tabular-nums">{fmtDate(e[k])}</span>;
  return <Input type="date" className="!h-8 !w-36" defaultValue={e[k] ?? ''} key={e[k] ?? ''} onBlur={(ev) => ev.target.value !== (e[k] ?? '') && save(e, k, ev.target.value)} />;
}

function AddEquipment({ onClose }: { onClose: () => void }) {
  const { data: b } = useBundle();
  const { run, pending } = useAct();
  const [f, setF] = useState({ tag: '', description: '', vendor: '', systemId: '', requiredOnSite: '', promisedDelivery: '', startupNeeded: true, witnessNeeded: false });
  if (!b) return null;
  return (
    <Modal open onClose={onClose} title="Track equipment" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={pending} disabled={!f.tag.trim()} onClick={async () => { await run(`/projects/${b.project.id}/equipment`, { ...f, systemId: f.systemId || null, requiredOnSite: f.requiredOnSite || null, promisedDelivery: f.promisedDelivery || null }, 'POST', 'Equipment added'); onClose(); }}>Add</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tag"><Input autoFocus value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} placeholder="UPS-B3" /></Field>
        <Field label="Vendor"><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
        <Field label="Description" className="col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="System" className="col-span-2"><Select value={f.systemId} onChange={(e) => setF({ ...f, systemId: e.target.value })}><option value="">—</option>{b.systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Required on site"><Input type="date" value={f.requiredOnSite} onChange={(e) => setF({ ...f, requiredOnSite: e.target.value })} /></Field>
        <Field label="Promised delivery"><Input type="date" value={f.promisedDelivery} onChange={(e) => setF({ ...f, promisedDelivery: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.startupNeeded} onChange={(e) => setF({ ...f, startupNeeded: e.target.checked })} /> Vendor start-up needed</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.witnessNeeded} onChange={(e) => setF({ ...f, witnessNeeded: e.target.checked })} /> Witness test needed</label>
      </div>
    </Modal>
  );
}
