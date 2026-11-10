import { useState } from 'react';
import { CATEGORY_LABELS, CONSTRAINT_CATEGORIES, addDays, type ConstraintCategory } from '@lookahead/shared';
import { useAct, useBundle, useLookups } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { Button, Field, Input, Select } from './ui';

/** FR-04 copy, shown before the user can save. */
export const ORPHAN_SENTENCE = 'Every constraint needs an owner and a needed-by date, so someone is accountable for clearing it in time.';

export function ConstraintForm({
  activityId,
  taskId,
  milestoneId,
  onDone,
}: {
  activityId?: string | null;
  taskId?: string | null;
  milestoneId?: string | null;
  onDone: () => void;
}) {
  const { data: b } = useBundle();
  const L = useLookups(b);
  const { me } = useAuth();
  const { run, pending } = useAct();
  const act = activityId ? L.activity.get(activityId) : undefined;
  const ms = milestoneId ? L.milestone.get(milestoneId) : undefined;
  const defaultNeeded = act ? addDays(act.plannedStart, -3) : ms?.targetDate ? addDays(ms.targetDate, -3) : '';
  const [f, setF] = useState({
    description: '',
    category: 'rfi' as ConstraintCategory,
    activityId: activityId ?? '',
    taskId: taskId ?? '',
    ownerUserId: L.isSuper ? '' : me?.user.id ?? '',
    neededBy: defaultNeeded,
    promisedDate: '',
    refNumber: '',
  });
  const [tried, setTried] = useState(false);
  if (!b) return null;
  const orphan = !f.ownerUserId || !f.neededBy;
  const tasks = b.tasks.filter((t) => t.activityId === f.activityId);
  const neededAfterStart = act && f.neededBy && f.neededBy > act.plannedStart;

  const save = async () => {
    setTried(true);
    if (orphan || !f.description.trim()) return;
    await run(
      `/projects/${b.project.id}/constraints`,
      {
        description: f.description.trim(),
        category: f.category,
        activityId: f.activityId || null,
        taskId: f.taskId || null,
        milestoneId: milestoneId ?? null,
        ownerUserId: f.ownerUserId,
        neededBy: f.neededBy,
        promisedDate: f.promisedDate || null,
        refNumber: f.refNumber || null,
      },
      'POST',
      'Constraint logged',
    );
    onDone();
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <Field label="What is missing?" error={tried && !f.description.trim() ? 'Describe the constraint.' : null}>
        <Input autoFocus value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Vendor start-up technician booked for UPS B" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ConstraintCategory })}>
            {CONSTRAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        {(f.category === 'rfi' || f.category === 'submittal') && (
          <Field label={f.category === 'rfi' ? 'RFI number' : 'Submittal number'}>
            <Input value={f.refNumber} onChange={(e) => setF({ ...f, refNumber: e.target.value })} placeholder={f.category === 'rfi' ? 'RFI-048' : 'SUB-0142'} />
          </Field>
        )}
      </div>
      {!activityId && !milestoneId && (
        <Field label="Blocks activity">
          <Select value={f.activityId} onChange={(e) => setF({ ...f, activityId: e.target.value, taskId: '' })}>
            <option value="">— none —</option>
            {b.activities
              .filter((a) => !a.actualFinish)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
        </Field>
      )}
      {tasks.length > 1 && (
        <Field label="Specific crew task (optional)">
          <Select value={f.taskId} onChange={(e) => setF({ ...f, taskId: e.target.value })}>
            <option value="">Whole activity</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner (named person)">
          <Select value={f.ownerUserId} onChange={(e) => setF({ ...f, ownerUserId: e.target.value })} className={tried && !f.ownerUserId ? 'border-risk-600' : ''}>
            <option value="">Choose…</option>
            {b.members
              .filter((m) => m.role !== 'owner_viewer')
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Needed by" hint={neededAfterStart ? <span className="text-risk-700">That is after the work starts ({act!.plannedStart}).</span> : undefined}>
          <Input type="date" value={f.neededBy} onChange={(e) => setF({ ...f, neededBy: e.target.value })} className={tried && !f.neededBy ? 'border-risk-600' : ''} />
        </Field>
      </div>
      <Field label="Promised date (optional)" hint="When the owner commits to clear it.">
        <Input type="date" value={f.promisedDate} onChange={(e) => setF({ ...f, promisedDate: e.target.value })} />
      </Field>
      {orphan && <p className={tried ? 'text-sm font-medium text-risk-700' : 'text-sm text-slate-500'}>{ORPHAN_SENTENCE}</p>}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="primary" onClick={save} loading={pending} disabled={tried && (orphan || !f.description.trim())}>
          Log constraint
        </Button>
      </div>
    </div>
  );
}
