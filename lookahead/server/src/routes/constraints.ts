// Constraint log and lifecycle (FR-03..FR-06, §8): Raised → Owned → Promised → Cleared | Missed.
import { Router } from 'express';
import { z } from 'zod';
import { CONSTRAINT_CATEGORIES, CONSTRAINT_STATUSES, VARIANCE_REASONS, type Constraint } from '@lookahead/shared';
import { authorize, projectOf, roleCan } from '../access';
import { audit, diff } from '../audit';
import { one, pool, q, tx, type Db } from '../db';
import { bad, forbidden, h } from '../errors';
import { notify } from '../notify';

export const constraints = Router();

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date (YYYY-MM-DD)');

/** FR-04: one sentence, shown in the UI as-is. */
export const ORPHAN_MESSAGE = 'Every constraint needs an owner and a needed-by date, so someone is accountable for clearing it in time.';

export async function nextNumber(c: Db, projectId: string): Promise<number> {
  await c.query('select id from projects where id = $1 for update', [projectId]);
  const r = await one<{ n: number }>(c, 'select coalesce(max(number), 0) + 1 as n from constraints where project_id = $1', [projectId]);
  return r!.n;
}

async function assertMember(c: Db, projectId: string, userId: string | null | undefined) {
  if (!userId) return;
  const m = await one(c, 'select 1 as ok from project_members where project_id = $1 and user_id = $2', [projectId, userId]);
  if (!m) throw bad('The owner must be a member of this project.');
}

async function assertBelongs(c: Db, projectId: string, refs: Record<string, string | null | undefined>) {
  const tables: Record<string, string> = { activityId: 'activities', taskId: 'tasks', milestoneId: 'milestones', equipmentId: 'equipment' };
  for (const [k, id] of Object.entries(refs)) {
    if (!id) continue;
    const r = await one(c, `select project_id from ${tables[k]} where id = $1`, [id]);
    if (!r || r.projectId !== projectId) throw bad(`Unknown ${k.replace('Id', '')}.`);
  }
}

const createSchema = z.object({
  description: z.string().trim().min(1, 'describe what is missing'),
  category: z.enum(CONSTRAINT_CATEGORIES),
  activityId: uuid.nullable().optional(),
  taskId: uuid.nullable().optional(),
  milestoneId: uuid.nullable().optional(),
  equipmentId: uuid.nullable().optional(),
  ownerUserId: uuid.nullable().optional(),
  neededBy: isoDate.nullable().optional(),
  promisedDate: isoDate.nullable().optional(),
  refNumber: z.string().nullable().optional(),
});

constraints.post(
  '/projects/:pid/constraints',
  h(async (req, res) => {
    const pid = req.params.pid;
    await authorize(req, pid, 'constraint.create');
    const body = createSchema.parse(req.body);
    if (!body.ownerUserId || !body.neededBy) throw bad(ORPHAN_MESSAGE, { code: 'orphan' });
    const c = await tx(async (c) => {
      await assertMember(c, pid, body.ownerUserId);
      if (body.taskId && !body.activityId) body.activityId = (await one(c, 'select activity_id from tasks where id = $1', [body.taskId]))?.activityId;
      await assertBelongs(c, pid, { activityId: body.activityId, taskId: body.taskId, milestoneId: body.milestoneId, equipmentId: body.equipmentId });
      const n = await nextNumber(c, pid);
      const row = await one<Constraint>(
        c,
        `insert into constraints (project_id, number, description, category, activity_id, task_id, milestone_id, equipment_id, owner_user_id, needed_by, promised_date, ref_number, status, raised_by_user_id, raised_by_name)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
        [pid, n, body.description, body.category, body.activityId ?? null, body.taskId ?? null, body.milestoneId ?? null, body.equipmentId ?? null,
          body.ownerUserId, body.neededBy, body.promisedDate ?? null, body.refNumber ?? null, body.promisedDate ? 'promised' : 'open', req.user!.id, req.user!.name],
      );
      await audit(c, { projectId: pid, entityType: 'constraint', entityId: row!.id, action: 'create', changes: { ownerUserId: body.ownerUserId, neededBy: body.neededBy }, actor: req.user! });
      if (body.ownerUserId !== req.user!.id)
        await notify(c, {
          projectId: pid, userIds: [body.ownerUserId!], kind: 'constraint_assigned', entityType: 'constraint', entityId: row!.id,
          title: `You own constraint #${n}: ${body.description}`, body: `${req.user!.name} assigned you constraint #${n} "${body.description}", needed by ${body.neededBy}.`,
          link: `/p/${pid}/constraints?c=${row!.id}`,
        });
      return row;
    });
    res.status(201).json(c);
  }),
);

const patchSchema = createSchema.partial().extend({
  status: z.enum(CONSTRAINT_STATUSES).optional(),
  clearanceNote: z.string().nullable().optional(),
  varianceReason: z.enum(VARIANCE_REASONS).nullable().optional(),
});

constraints.patch(
  '/constraints/:id',
  h(async (req, res) => {
    const pid = await projectOf('constraints', req.params.id);
    const m = await authorize(req, pid, 'constraint.edit.own');
    const body = patchSchema.parse(req.body);
    const out = await tx(async (c) => {
      const before = await one<Constraint>(c, 'select * from constraints where id = $1 for update', [req.params.id]);
      if (!before) throw bad('Not found.');
      const isOwner = before.ownerUserId === req.user!.id || (before.status === 'raised' && before.raisedByUserId === req.user!.id);
      if (!roleCan(m.role, 'constraint.edit.any') && !isOwner) throw forbidden('Only the owner or the super can change this constraint.');
      if (!roleCan(m.role, 'constraint.edit.any') && body.ownerUserId !== undefined && body.ownerUserId !== before.ownerUserId)
        throw forbidden('Only the super can reassign a constraint.');

      const next = { ...before, ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)) } as Constraint & { clearanceNote: string | null };
      await assertMember(c, pid, next.ownerUserId);
      await assertBelongs(c, pid, { activityId: body.activityId, taskId: body.taskId, milestoneId: body.milestoneId, equipmentId: body.equipmentId });

      // Lifecycle rules
      let status = body.status ?? before.status;
      if (status === 'raised' && next.ownerUserId && next.neededBy) status = 'open'; // owned
      if (status !== 'raised' && (!next.ownerUserId || !next.neededBy)) throw bad(ORPHAN_MESSAGE, { code: 'orphan' });
      if (body.promisedDate && (status === 'open' || status === 'raised')) status = 'promised';
      if (status === 'promised' && !next.promisedDate) throw bad('Give the date you promise to clear this by.');
      if (status === 'cleared' && before.status !== 'cleared' && !next.clearanceNote?.trim())
        throw bad('Add a short note on how it was cleared (evidence or confirmation).');
      if (status === 'missed' && !next.varianceReason) throw bad('Pick the reason this constraint was missed.');

      const row = await one<Constraint>(
        c,
        `update constraints set description = $2, category = $3, activity_id = $4, task_id = $5, milestone_id = $6, equipment_id = $7,
           owner_user_id = $8, needed_by = $9, promised_date = $10, ref_number = $11, status = $12,
           cleared_at = case when $12 = 'cleared' then coalesce(cleared_at, now()) else null end,
           cleared_by = case when $12 = 'cleared' then coalesce(cleared_by, $13::uuid) else null end,
           clearance_note = case when $12 = 'cleared' then $14 else null end,
           missed_at = case when $12 = 'missed' then coalesce(missed_at, now()) else null end,
           variance_reason = $15, updated_at = now()
         where id = $1 returning *`,
        [req.params.id, next.description, next.category, next.activityId, next.taskId, next.milestoneId, next.equipmentId,
          next.ownerUserId, next.neededBy, next.promisedDate, next.refNumber, status, req.user!.id, next.clearanceNote ?? null, next.varianceReason ?? null],
      );
      const changes = diff(before as any, { ownerUserId: next.ownerUserId, neededBy: next.neededBy, promisedDate: next.promisedDate, status, description: next.description, category: next.category });
      if (Object.keys(changes).length)
        await audit(c, { projectId: pid, entityType: 'constraint', entityId: row!.id, action: status !== before.status ? `status_${status}` : 'update', changes, actor: req.user! });
      if (next.ownerUserId && next.ownerUserId !== before.ownerUserId && next.ownerUserId !== req.user!.id)
        await notify(c, {
          projectId: pid, userIds: [next.ownerUserId], kind: 'constraint_assigned', entityType: 'constraint', entityId: row!.id,
          title: `You own constraint #${row!.number}: ${row!.description}`, body: `${req.user!.name} assigned you constraint #${row!.number}, needed by ${row!.neededBy}.`,
          link: `/p/${pid}/constraints?c=${row!.id}`,
        });
      return row;
    });
    res.json(out);
  }),
);

constraints.delete(
  '/constraints/:id',
  h(async (req, res) => {
    const pid = await projectOf('constraints', req.params.id);
    await authorize(req, pid, 'constraint.edit.any');
    const c = await one(pool, 'delete from constraints where id = $1 returning number, description', [req.params.id]);
    await audit(pool, { projectId: pid, entityType: 'constraint', entityId: req.params.id, action: 'delete', changes: c ?? {}, actor: req.user! });
    res.json({ ok: true });
  }),
);

constraints.get(
  '/constraints/:id/comments',
  h(async (req, res) => {
    const pid = await projectOf('constraints', req.params.id);
    await authorize(req, pid, 'read');
    res.json(await q(pool, 'select * from constraint_comments where constraint_id = $1 order by created_at', [req.params.id]));
  }),
);

constraints.post(
  '/constraints/:id/comments',
  h(async (req, res) => {
    const pid = await projectOf('constraints', req.params.id);
    await authorize(req, pid, 'comment');
    const { body } = z.object({ body: z.string().trim().min(1) }).parse(req.body);
    const row = await one(pool, 'insert into constraint_comments (constraint_id, author_user_id, author_name, body) values ($1, $2, $3, $4) returning *', [req.params.id, req.user!.id, req.user!.name, body]);
    const c = await one<Constraint>(pool, 'select * from constraints where id = $1', [req.params.id]);
    if (c?.ownerUserId && c.ownerUserId !== req.user!.id)
      await notify(pool, { projectId: pid, userIds: [c.ownerUserId], kind: 'constraint_comment', entityType: 'constraint', entityId: c.id, title: `${req.user!.name} commented on #${c.number}`, body, email: false });
    res.status(201).json(row);
  }),
);
