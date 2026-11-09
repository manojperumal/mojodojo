// Activities, tasks, milestones, equipment (FR-01, FR-02, FR-07, §9).
import { Router } from 'express';
import { z } from 'zod';
import { diffDays, READINESS_STATES, MILESTONE_KINDS } from '@lookahead/shared';
import { authorize, projectOf } from '../access';
import { audit, diff } from '../audit';
import { one, pool, q, setClause, tx, type Db } from '../db';
import { bad, h } from '../errors';
import { notify } from '../notify';
import { createDefaultTask } from '../import/apply';

export const plan = Router();

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date (YYYY-MM-DD)');
const optDate = isoDate.nullable().optional();

const activityFields = {
  name: z.string().min(1),
  areaId: uuid.nullable().optional(),
  systemId: uuid.nullable().optional(),
  tradeId: uuid.nullable().optional(),
  cxLevel: z.number().int().min(1).max(5).nullable().optional(),
  plannedStart: isoDate,
  plannedFinish: isoDate,
  actualStart: optDate,
  actualFinish: optDate,
  crewSize: z.number().int().min(0).nullable().optional(),
  externalRef: z.string().nullable().optional(),
  predecessorIds: z.array(uuid).optional(),
  equipmentIds: z.array(uuid).optional(),
};
const ACTIVITY_COLS = ['name', 'areaId', 'systemId', 'tradeId', 'cxLevel', 'plannedStart', 'plannedFinish', 'actualStart', 'actualFinish', 'crewSize', 'externalRef'];

async function setLinks(c: Db, activityId: string, predecessorIds?: string[], equipmentIds?: string[]) {
  if (predecessorIds) {
    await c.query('delete from activity_predecessors where activity_id = $1', [activityId]);
    for (const p of predecessorIds.filter((p) => p !== activityId))
      await c.query('insert into activity_predecessors (activity_id, predecessor_id) values ($1, $2) on conflict do nothing', [activityId, p]);
  }
  if (equipmentIds) {
    await c.query('delete from activity_equipment where activity_id = $1', [activityId]);
    for (const e of equipmentIds) await c.query('insert into activity_equipment (activity_id, equipment_id) values ($1, $2) on conflict do nothing', [activityId, e]);
  }
}

plan.post(
  '/projects/:pid/activities',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const body = z.object(activityFields).parse(req.body);
    if (body.plannedFinish < body.plannedStart) throw bad('Finish date is before the start date.');
    const a = await tx(async (c) => {
      const s = setClause(body, ACTIVITY_COLS, 3);
      const cols = s.sql.split(', ').map((x) => x.split(' = ')[0]);
      const a = await one(
        c,
        `insert into activities (project_id, updated_by, ${cols.join(', ')}) values ($1, $2, ${s.keys.map((_, i) => `$${i + 3}`).join(', ')}) returning *`,
        [req.params.pid, req.user!.id, ...s.values],
      );
      await setLinks(c, a.id, body.predecessorIds, body.equipmentIds);
      // Every activity starts with one crew task so it can be committed; the super can split it (decision D-3).
      await createDefaultTask(c, req.params.pid, a);
      await audit(c, { projectId: req.params.pid, entityType: 'activity', entityId: a.id, action: 'create', changes: { name: body.name, plannedStart: body.plannedStart, plannedFinish: body.plannedFinish }, actor: req.user! });
      return a;
    });
    res.status(201).json(a);
  }),
);

/** FR-01 drag-to-reschedule and FR-02 edits. Moving both dates by the same amount shifts the activity's tasks too. */
plan.patch(
  '/activities/:id',
  h(async (req, res) => {
    const pid = await projectOf('activities', req.params.id);
    await authorize(req, pid, 'plan.edit');
    const body = z.object(activityFields).partial().extend({ shiftTasks: z.boolean().default(true) }).parse(req.body);
    const out = await tx(async (c) => {
      const before = await one(c, 'select * from activities where id = $1 for update', [req.params.id]);
      const start = body.plannedStart ?? before.plannedStart;
      const finish = body.plannedFinish ?? before.plannedFinish;
      if (finish < start) throw bad('Finish date is before the start date.');
      const s = setClause(body, ACTIVITY_COLS, 3);
      const a = s.keys.length
        ? await one(c, `update activities set ${s.sql}, updated_at = now(), updated_by = $2 where id = $1 returning *`, [req.params.id, req.user!.id, ...s.values])
        : await one(c, 'update activities set updated_at = now(), updated_by = $2 where id = $1 returning *', [req.params.id, req.user!.id]);
      const delta = diffDays(before.plannedStart, start);
      if (body.shiftTasks && delta !== 0 && diffDays(before.plannedFinish, finish) === delta) {
        await c.query(
          `update tasks set planned_start = planned_start + $2::int, planned_finish = planned_finish + $2::int, updated_at = now() where activity_id = $1`,
          [req.params.id, delta],
        );
      }
      await setLinks(c, req.params.id, body.predecessorIds, body.equipmentIds);
      const changes = diff(before, Object.fromEntries(s.keys.map((k) => [k, (body as any)[k]])));
      if (Object.keys(changes).length) await audit(c, { projectId: pid, entityType: 'activity', entityId: req.params.id, action: 'update', changes, actor: req.user! });
      return a;
    });
    res.json(out);
  }),
);

plan.delete(
  '/activities/:id',
  h(async (req, res) => {
    const pid = await projectOf('activities', req.params.id);
    await authorize(req, pid, 'plan.edit');
    const a = await one(pool, 'delete from activities where id = $1 returning name', [req.params.id]);
    await audit(pool, { projectId: pid, entityType: 'activity', entityId: req.params.id, action: 'delete', changes: { name: a?.name }, actor: req.user! });
    res.json({ ok: true });
  }),
);

/** §6: readiness is computed; a super override is allowed, logged, and requires a note. */
plan.post(
  '/activities/:id/override',
  h(async (req, res) => {
    const pid = await projectOf('activities', req.params.id);
    await authorize(req, pid, 'plan.edit');
    const body = z.object({ state: z.enum(READINESS_STATES).nullable(), note: z.string().optional() }).parse(req.body);
    if (body.state && !body.note?.trim()) throw bad('Add a note explaining why you are overriding readiness.');
    const before = await one(pool, 'select readiness_override, override_note from activities where id = $1', [req.params.id]);
    const a = await one(
      pool,
      `update activities set readiness_override = $2, override_note = $3, override_by = $4, override_at = case when $2::text is null then null else now() end, updated_at = now(), updated_by = $4
       where id = $1 returning *`,
      [req.params.id, body.state, body.state ? body.note!.trim() : null, req.user!.id],
    );
    await audit(pool, {
      projectId: pid, entityType: 'activity', entityId: req.params.id, action: body.state ? 'readiness_override' : 'readiness_override_cleared',
      changes: { readinessOverride: { from: before.readinessOverride, to: body.state }, note: body.note ?? null }, actor: req.user!,
    });
    res.json(a);
  }),
);

// ---------- Tasks (crew-level breakdown, decision D-3) ----------
const taskFields = {
  name: z.string().min(1),
  tradeId: uuid.nullable().optional(),
  crewSize: z.number().int().min(0).nullable().optional(),
  plannedStart: isoDate,
  plannedFinish: isoDate,
};

plan.post(
  '/activities/:id/tasks',
  h(async (req, res) => {
    const pid = await projectOf('activities', req.params.id);
    await authorize(req, pid, 'plan.edit');
    const body = z.object(taskFields).parse(req.body);
    if (body.plannedFinish < body.plannedStart) throw bad('Finish date is before the start date.');
    const a = await one(pool, 'select trade_id, crew_size from activities where id = $1', [req.params.id]);
    const t = await one(
      pool,
      `insert into tasks (project_id, activity_id, name, trade_id, crew_size, planned_start, planned_finish) values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [pid, req.params.id, body.name, body.tradeId ?? a.tradeId, body.crewSize ?? a.crewSize, body.plannedStart, body.plannedFinish],
    );
    await pool.query('update activities set updated_at = now() where id = $1', [req.params.id]);
    res.status(201).json(t);
  }),
);

plan.patch(
  '/tasks/:id',
  h(async (req, res) => {
    const pid = await projectOf('tasks', req.params.id);
    await authorize(req, pid, 'plan.edit');
    const body = z.object(taskFields).partial().parse(req.body);
    const before = await one(pool, 'select * from tasks where id = $1', [req.params.id]);
    if ((body.plannedFinish ?? before.plannedFinish) < (body.plannedStart ?? before.plannedStart)) throw bad('Finish date is before the start date.');
    const s = setClause(body, ['name', 'tradeId', 'crewSize', 'plannedStart', 'plannedFinish'], 2);
    if (!s.keys.length) throw bad('Nothing to update.');
    const t = await one(pool, `update tasks set ${s.sql}, updated_at = now() where id = $1 returning *`, [req.params.id, ...s.values]);
    await pool.query('update activities set updated_at = now() where id = $1', [t.activityId]);
    const changes = diff(before, body);
    if (changes.plannedStart || changes.plannedFinish) await audit(pool, { projectId: pid, entityType: 'task', entityId: t.id, action: 'update', changes, actor: req.user! });
    res.json(t);
  }),
);

plan.delete(
  '/tasks/:id',
  h(async (req, res) => {
    const pid = await projectOf('tasks', req.params.id);
    await authorize(req, pid, 'plan.edit');
    await pool.query('delete from tasks where id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);

// ---------- Milestones & energization gates (§9) ----------
const milestoneFields = {
  name: z.string().min(1),
  kind: z.enum(MILESTONE_KINDS).optional(),
  cxLevel: z.number().int().min(1).max(5).nullable().optional(),
  systemId: uuid.nullable().optional(),
  targetDate: optDate,
  forecastDate: optDate,
  confidence: z.enum(['high', 'medium', 'low']).nullable().optional(),
  authoriserUserId: uuid.nullable().optional(),
  activityIds: z.array(uuid).optional(),
};
const MILESTONE_COLS = ['name', 'kind', 'cxLevel', 'systemId', 'targetDate', 'forecastDate', 'confidence', 'authoriserUserId'];

async function setMilestoneActivities(c: Db, id: string, ids?: string[]) {
  if (!ids) return;
  await c.query('delete from milestone_activities where milestone_id = $1', [id]);
  for (const a of ids) await c.query('insert into milestone_activities (milestone_id, activity_id) values ($1, $2) on conflict do nothing', [id, a]);
}

plan.post(
  '/projects/:pid/milestones',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const body = z.object(milestoneFields).parse(req.body);
    const m = await tx(async (c) => {
      const s = setClause(body, MILESTONE_COLS, 2);
      const cols = s.sql.split(', ').map((x) => x.split(' = ')[0]);
      const m = await one(c, `insert into milestones (project_id, ${cols.join(', ')}) values ($1, ${s.keys.map((_, i) => `$${i + 2}`).join(', ')}) returning *`, [req.params.pid, ...s.values]);
      await setMilestoneActivities(c, m.id, body.activityIds);
      return m;
    });
    res.status(201).json(m);
  }),
);

plan.patch(
  '/milestones/:id',
  h(async (req, res) => {
    const pid = await projectOf('milestones', req.params.id);
    await authorize(req, pid, 'plan.edit');
    const body = z.object(milestoneFields).partial().parse(req.body);
    const m = await tx(async (c) => {
      const before = await one(c, 'select * from milestones where id = $1', [req.params.id]);
      const s = setClause(body, MILESTONE_COLS, 2);
      const m = s.keys.length ? await one(c, `update milestones set ${s.sql}, updated_at = now() where id = $1 returning *`, [req.params.id, ...s.values]) : before;
      await setMilestoneActivities(c, req.params.id, body.activityIds);
      const changes = diff(before, body);
      delete (changes as any).activityIds;
      if (Object.keys(changes).length) await audit(c, { projectId: pid, entityType: 'milestone', entityId: req.params.id, action: 'update', changes, actor: req.user! });
      return m;
    });
    res.json(m);
  }),
);

plan.delete(
  '/milestones/:id',
  h(async (req, res) => {
    const pid = await projectOf('milestones', req.params.id);
    await authorize(req, pid, 'plan.edit');
    await pool.query('delete from milestones where id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);

/** Energization mini-gate sign-off by the named authoriser (CxA or super). */
plan.post(
  '/milestones/:id/confirm-gate',
  h(async (req, res) => {
    const pid = await projectOf('milestones', req.params.id);
    await authorize(req, pid, 'gate.confirm');
    const { confirmed } = z.object({ confirmed: z.boolean() }).parse(req.body);
    if (confirmed) {
      const open = await q(pool, `select number from constraints where milestone_id = $1 and status <> 'cleared'`, [req.params.id]);
      if (open.length) throw bad(`Clear the gate's open constraints first (#${open.map((o) => o.number).join(', #')}).`);
    }
    const m = await one(
      pool,
      `update milestones set gate_confirmed_at = case when $2 then now() else null end, gate_confirmed_by = case when $2 then $3::uuid else null end, updated_at = now() where id = $1 returning *`,
      [req.params.id, confirmed, req.user!.id],
    );
    await audit(pool, { projectId: pid, entityType: 'milestone', entityId: req.params.id, action: confirmed ? 'gate_confirmed' : 'gate_unconfirmed', actor: req.user! });
    res.json(m);
  }),
);

// ---------- Equipment (FR-07) ----------
const equipmentFields = {
  tag: z.string().min(1),
  description: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  systemId: uuid.nullable().optional(),
  areaId: uuid.nullable().optional(),
  requiredOnSite: optDate,
  promisedDelivery: optDate,
  actualDelivery: optDate,
  startupNeeded: z.boolean().optional(),
  witnessNeeded: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  activityIds: z.array(uuid).optional(),
};
const EQUIPMENT_COLS = ['tag', 'description', 'vendor', 'systemId', 'areaId', 'requiredOnSite', 'promisedDelivery', 'actualDelivery', 'startupNeeded', 'witnessNeeded', 'notes'];

async function setEquipmentActivities(c: Db, id: string, ids?: string[]) {
  if (!ids) return;
  await c.query('delete from activity_equipment where equipment_id = $1', [id]);
  for (const a of ids) await c.query('insert into activity_equipment (activity_id, equipment_id) values ($1, $2) on conflict do nothing', [a, id]);
}

plan.post(
  '/projects/:pid/equipment',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const body = z.object(equipmentFields).parse(req.body);
    const e = await tx(async (c) => {
      const s = setClause(body, EQUIPMENT_COLS, 2);
      const cols = s.sql.split(', ').map((x) => x.split(' = ')[0]);
      const e = await one(c, `insert into equipment (project_id, ${cols.join(', ')}) values ($1, ${s.keys.map((_, i) => `$${i + 2}`).join(', ')}) returning *`, [req.params.pid, ...s.values]);
      await setEquipmentActivities(c, e.id, body.activityIds);
      return e;
    });
    res.status(201).json(e);
  }),
);

plan.patch(
  '/equipment/:id',
  h(async (req, res) => {
    const pid = await projectOf('equipment', req.params.id);
    const m = await authorize(req, pid, 'equipment.edit');
    const body = z.object(equipmentFields).partial().parse(req.body);
    if (m.role !== 'super') {
      // PM / field engineer: delivery dates and notes only.
      for (const k of Object.keys(body)) if (!['requiredOnSite', 'promisedDelivery', 'actualDelivery', 'notes'].includes(k)) throw bad('Only the super can change that field.');
    }
    const e = await tx(async (c) => {
      const before = await one(c, 'select * from equipment where id = $1', [req.params.id]);
      const s = setClause(body, EQUIPMENT_COLS, 2);
      const e = s.keys.length ? await one(c, `update equipment set ${s.sql}, updated_at = now() where id = $1 returning *`, [req.params.id, ...s.values]) : before;
      await setEquipmentActivities(c, req.params.id, body.activityIds);
      const changes = diff(before, body);
      delete (changes as any).activityIds;
      if (Object.keys(changes).length) await audit(c, { projectId: pid, entityType: 'equipment', entityId: e.id, action: 'update', changes, actor: req.user! });
      // FR-07: a new slip flags linked activities AT RISK (computed) — tell the supers now.
      const slipped = (x: any) => !x.actualDelivery && x.promisedDelivery && x.requiredOnSite && x.promisedDelivery > x.requiredOnSite;
      if (slipped(e) && !slipped(before)) {
        const supers = await q(c, `select user_id from project_members where project_id = $1 and role = 'super'`, [pid]);
        await notify(c, {
          projectId: pid, userIds: supers.map((s) => s.userId), kind: 'equipment_slip', entityType: 'equipment', entityId: e.id,
          title: `${e.tag} slipped: promised ${e.promisedDelivery}, needed on site ${e.requiredOnSite}`,
          body: `${e.tag} (${e.description ?? 'equipment'}) is now promised ${diffDays(e.requiredOnSite, e.promisedDelivery)} days after its required-on-site date. Linked activities are flagged AT RISK.`,
          link: `/p/${pid}/equipment`,
        });
      }
      return e;
    });
    res.json(e);
  }),
);

plan.delete(
  '/equipment/:id',
  h(async (req, res) => {
    const pid = await projectOf('equipment', req.params.id);
    await authorize(req, pid, 'plan.edit');
    await pool.query('delete from equipment where id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);

