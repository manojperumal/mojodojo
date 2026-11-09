import { addDays, getTemplate, type Role } from '@lookahead/shared';
import type { PoolClient } from 'pg';
import { audit, type Actor } from '../audit';
import { one, q } from '../db';
import { bad } from '../errors';
import { nextNumber } from '../routes/constraints';
import type { ImportPlan } from './normalize';

export interface ImportResult {
  activities: { created: number; updated: number };
  equipment: { created: number; updated: number };
  constraints: { created: number; updated: number };
  milestones: { created: number };
  errors: { row: number; message: string }[];
}

/** Find-or-create a named lookup row (area / system / trade). */
async function lookup(c: PoolClient, table: 'areas' | 'systems' | 'trades', projectId: string, name: string | null | undefined, cache: Map<string, string>) {
  if (!name) return null;
  const key = `${table}:${name.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;
  let row = await one(c, `select id from ${table} where project_id = $1 and lower(name) = lower($2)`, [projectId, name]);
  row ??= await one(c, `insert into ${table} (project_id, name) values ($1, $2) returning id`, [projectId, name]);
  cache.set(key, row.id);
  return row.id as string;
}

export async function createDefaultTask(c: PoolClient, projectId: string, a: { id: string; name: string; tradeId: string | null; crewSize: number | null; plannedStart: string; plannedFinish: string }) {
  await c.query(
    `insert into tasks (project_id, activity_id, name, trade_id, crew_size, planned_start, planned_finish) values ($1, $2, $3, $4, $5, $6, $7)`,
    [projectId, a.id, a.name, a.tradeId, a.crewSize, a.plannedStart, a.plannedFinish],
  );
}

export async function applyImport(c: PoolClient, projectId: string, plan: ImportPlan, actor: Actor): Promise<ImportResult> {
  const res: ImportResult = {
    activities: { created: 0, updated: 0 }, equipment: { created: 0, updated: 0 }, constraints: { created: 0, updated: 0 }, milestones: { created: 0 }, errors: [],
  };
  const cache = new Map<string, string>();
  const refToId = new Map<string, string>();
  for (const r of await q(c, 'select id, external_ref from activities where project_id = $1 and external_ref is not null', [projectId])) refToId.set(r.externalRef, r.id);

  for (const a of plan.activities) {
    const areaId = await lookup(c, 'areas', projectId, a.area, cache);
    const systemId = await lookup(c, 'systems', projectId, a.system, cache);
    const tradeId = await lookup(c, 'trades', projectId, a.trade, cache);
    const existing = a.ref ? await one(c, 'select * from activities where project_id = $1 and external_ref = $2', [projectId, a.ref]) : null;
    if (existing) {
      await c.query(
        `update activities set name = $2, area_id = coalesce($3, area_id), system_id = coalesce($4, system_id), trade_id = coalesce($5, trade_id),
           planned_start = $6, planned_finish = $7, actual_start = coalesce($8, actual_start), actual_finish = coalesce($9, actual_finish),
           crew_size = coalesce($10, crew_size), cx_level = coalesce($11, cx_level), updated_at = now() where id = $1`,
        [existing.id, a.name, areaId, systemId, tradeId, a.start, a.finish, a.actualStart ?? null, a.actualFinish ?? null, a.crewSize ?? null, a.cxLevel ?? null],
      );
      const delta = (Date.parse(a.start) - Date.parse(existing.plannedStart)) / 86_400_000;
      if (delta) await c.query('update tasks set planned_start = planned_start + $2::int, planned_finish = planned_finish + $2::int where activity_id = $1', [existing.id, delta]);
      if (existing.plannedStart !== a.start || existing.plannedFinish !== a.finish)
        await audit(c, { projectId, entityType: 'activity', entityId: existing.id, action: `import_${plan.source}`, changes: { plannedStart: { from: existing.plannedStart, to: a.start }, plannedFinish: { from: existing.plannedFinish, to: a.finish } }, actor });
      res.activities.updated++;
    } else {
      const row = await one(
        c,
        `insert into activities (project_id, name, area_id, system_id, trade_id, planned_start, planned_finish, actual_start, actual_finish, crew_size, cx_level, external_ref)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
        [projectId, a.name, areaId, systemId, tradeId, a.start, a.finish, a.actualStart ?? null, a.actualFinish ?? null, a.crewSize ?? null, a.cxLevel ?? null, a.ref],
      );
      await createDefaultTask(c, projectId, row);
      if (a.ref) refToId.set(a.ref, row.id);
      res.activities.created++;
    }
  }
  for (const a of plan.activities) {
    if (!a.ref || !a.predecessorRefs?.length) continue;
    const id = refToId.get(a.ref)!;
    for (const p of a.predecessorRefs) {
      const pid = refToId.get(p);
      if (pid && pid !== id) await c.query('insert into activity_predecessors (activity_id, predecessor_id) values ($1, $2) on conflict do nothing', [id, pid]);
    }
  }

  for (const e of plan.equipment) {
    const systemId = await lookup(c, 'systems', projectId, e.system, cache);
    const areaId = await lookup(c, 'areas', projectId, e.area, cache);
    const before = await one(c, 'select id from equipment where project_id = $1 and lower(tag) = lower($2)', [projectId, e.tag]);
    const row = await one(
      c,
      `insert into equipment (project_id, tag, description, vendor, system_id, area_id, required_on_site, promised_delivery, actual_delivery, startup_needed, witness_needed)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (project_id, tag) do update set description = coalesce(excluded.description, equipment.description), vendor = coalesce(excluded.vendor, equipment.vendor),
         system_id = coalesce(excluded.system_id, equipment.system_id), area_id = coalesce(excluded.area_id, equipment.area_id),
         required_on_site = coalesce(excluded.required_on_site, equipment.required_on_site), promised_delivery = coalesce(excluded.promised_delivery, equipment.promised_delivery),
         actual_delivery = coalesce(excluded.actual_delivery, equipment.actual_delivery), startup_needed = excluded.startup_needed, witness_needed = excluded.witness_needed, updated_at = now()
       returning id`,
      [projectId, before ? (await one(c, 'select tag from equipment where id = $1', [before.id])).tag : e.tag, e.description ?? null, e.vendor ?? null, systemId, areaId,
        e.requiredOnSite ?? null, e.promisedDelivery ?? null, e.actualDelivery ?? null, !!e.startupNeeded, !!e.witnessNeeded],
    );
    for (const ref of e.activityRefs ?? []) {
      const aid = refToId.get(ref);
      if (aid) await c.query('insert into activity_equipment (activity_id, equipment_id) values ($1, $2) on conflict do nothing', [aid, row.id]);
    }
    before ? res.equipment.updated++ : res.equipment.created++;
  }

  const members = await q(c, 'select u.id, lower(u.email) as email from project_members pm join users u on u.id = pm.user_id where pm.project_id = $1', [projectId]);
  const memberByEmail = new Map(members.map((m) => [m.email, m.id]));
  let row = 1;
  for (const k of plan.constraints) {
    row++;
    const owner = k.ownerEmail ? memberByEmail.get(k.ownerEmail.toLowerCase()) : null;
    if (!owner || !k.neededBy) {
      res.errors.push({ row, message: !k.ownerEmail || !k.neededBy ? 'Needs an owner email and a needed-by date (FR-04).' : `${k.ownerEmail} is not a member of this project.` });
      continue;
    }
    let activityId: string | null = null;
    if (k.activity) {
      activityId = refToId.get(k.activity) ?? (await one(c, 'select id from activities where project_id = $1 and lower(name) = lower($2) limit 1', [projectId, k.activity]))?.id ?? null;
      if (!activityId) res.errors.push({ row, message: `Activity "${k.activity}" not found; imported without a link.` });
    }
    const existing = k.refNumber ? await one(c, 'select id from constraints where project_id = $1 and ref_number = $2', [projectId, k.refNumber]) : null;
    const status = k.status === 'cleared' ? 'cleared' : k.promisedDate ? 'promised' : 'open';
    if (existing) {
      await c.query(
        `update constraints set description = $2, category = $3, activity_id = coalesce($4, activity_id), owner_user_id = $5, needed_by = $6, promised_date = $7, status = $8,
           cleared_at = case when $8 = 'cleared' then coalesce(cleared_at, now()) else cleared_at end, updated_at = now() where id = $1`,
        [existing.id, k.description, k.category, activityId, owner, k.neededBy, k.promisedDate ?? null, status],
      );
      res.constraints.updated++;
    } else {
      const n = await nextNumber(c, projectId);
      await c.query(
        `insert into constraints (project_id, number, description, category, activity_id, owner_user_id, needed_by, promised_date, status, ref_number, raised_by_name, cleared_at, clearance_note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, case when $9 = 'cleared' then now() end, case when $9 = 'cleared' then 'Imported as cleared' end)`,
        [projectId, n, k.description, k.category, activityId, owner, k.neededBy, k.promisedDate ?? null, status, k.refNumber ?? null, actor.name],
      );
      res.constraints.created++;
    }
  }

  for (const m of plan.milestones) {
    const exists = await one(c, 'select id from milestones where project_id = $1 and lower(name) = lower($2)', [projectId, m.name]);
    if (exists) {
      await c.query('update milestones set target_date = $2, updated_at = now() where id = $1', [exists.id, m.targetDate]);
    } else {
      await c.query(`insert into milestones (project_id, name, kind, target_date) values ($1, $2, 'milestone', $3)`, [projectId, m.name, m.targetDate]);
      res.milestones.created++;
    }
  }
  await audit(c, { projectId, entityType: 'project', entityId: projectId, action: `import_${plan.source}`, changes: res as any, actor });
  return res;
}

/** FR-15 / §9: apply a pre-commissioning template to one system. */
export async function applyTemplate(
  c: PoolClient,
  projectId: string,
  opts: { templateKey: string; systemId: string; anchorDate: string; areaId?: string | null },
  actor: Actor & { id: string },
) {
  const tpl = getTemplate(opts.templateKey);
  if (!tpl) throw bad('Unknown template.');
  const system = await one(c, 'select * from systems where id = $1 and project_id = $2', [opts.systemId, projectId]);
  if (!system) throw bad('Unknown system.');
  const areaId = opts.areaId ?? system.areaId ?? null;
  const members = await q<{ userId: string; role: Role }>(c, 'select user_id, role from project_members where project_id = $1 order by created_at', [projectId]);
  const ownerFor = (role: Role) => members.find((m) => m.role === role)?.userId ?? (role === 'field_engineer' ? members.find((m) => m.role === 'pm')?.userId : undefined) ?? actor.id;
  const cache = new Map<string, string>();
  const ids = new Map<string, { id: string; start: string }>();
  let constraintsCreated = 0;

  for (const a of tpl.activities) {
    const tradeId = await lookup(c, 'trades', projectId, a.trade, cache);
    const start = addDays(opts.anchorDate, a.start);
    const finish = addDays(start, Math.max(0, a.duration - 1));
    const row = await one(
      c,
      `insert into activities (project_id, name, area_id, system_id, trade_id, cx_level, planned_start, planned_finish, crew_size, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [projectId, `${a.name} · ${system.name}`, areaId, system.id, tradeId, a.level, start, finish, a.crew, actor.id],
    );
    ids.set(a.key, { id: row.id, start });
    const taskNames = a.tasks?.length ? a.tasks : [a.name];
    for (const t of taskNames)
      await c.query(`insert into tasks (project_id, activity_id, name, trade_id, crew_size, planned_start, planned_finish) values ($1,$2,$3,$4,$5,$6,$7)`, [projectId, row.id, t, tradeId, a.crew, start, finish]);
    for (const k of a.constraints) {
      const n = await nextNumber(c, projectId);
      await c.query(
        `insert into constraints (project_id, number, description, category, activity_id, owner_user_id, needed_by, status, raised_by_user_id, raised_by_name)
         values ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9)`,
        [projectId, n, `${k.description} — ${system.name}`, k.category, row.id, ownerFor(k.ownerRole), addDays(start, k.neededByOffset), actor.id, actor.name],
      );
      constraintsCreated++;
    }
  }
  for (const a of tpl.activities)
    for (const p of a.predecessors ?? [])
      await c.query('insert into activity_predecessors (activity_id, predecessor_id) values ($1, $2) on conflict do nothing', [ids.get(a.key)!.id, ids.get(p)!.id]);

  // Long-lead equipment for this system feeds the first (set / install) activity.
  const first = ids.get(tpl.activities[0].key)!;
  await c.query(`insert into activity_equipment (activity_id, equipment_id) select $1, id from equipment where system_id = $2 on conflict do nothing`, [first.id, system.id]);

  for (const m of tpl.milestones) {
    const target = addDays(opts.anchorDate, m.offset);
    const row = await one(
      c,
      `insert into milestones (project_id, name, kind, cx_level, system_id, target_date, forecast_date, confidence) values ($1,$2,$3,$4,$5,$6,$6,'medium') returning id`,
      [projectId, `${m.name} · ${system.name}`, m.kind, m.cxLevel ?? null, system.id, target],
    );
    for (const k of m.activityKeys) await c.query('insert into milestone_activities (milestone_id, activity_id) values ($1, $2) on conflict do nothing', [row.id, ids.get(k)!.id]);
    for (const k of m.gate ?? []) {
      const n = await nextNumber(c, projectId);
      await c.query(
        `insert into constraints (project_id, number, description, category, milestone_id, owner_user_id, needed_by, status, raised_by_user_id, raised_by_name)
         values ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9)`,
        [projectId, n, `${k.description} — ${system.name}`, k.category, row.id, ownerFor(k.ownerRole), addDays(target, k.neededByOffset), actor.id, actor.name],
      );
      constraintsCreated++;
    }
  }
  await audit(c, { projectId, entityType: 'system', entityId: system.id, action: 'template_applied', changes: { template: tpl.key, anchorDate: opts.anchorDate }, actor });
  return { activities: tpl.activities.length, constraints: constraintsCreated, milestones: tpl.milestones.length };
}
