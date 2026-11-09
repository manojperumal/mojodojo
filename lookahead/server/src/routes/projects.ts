import { Router } from 'express';
import { z } from 'zod';
import {
  addDays,
  AREA_KINDS,
  constraintClearance,
  milestoneVariance,
  ppcByWeek,
  ppcGrouped,
  rfiCycle,
  ROLES,
  STALE_DAYS,
  startDelay,
  SYSTEM_TYPES,
  taskTradeKey,
  varianceBreakdown,
  weekStart,
  weeksInWindow,
} from '@lookahead/shared';
import { authorize, projectOf } from '../access';
import { audit, diff } from '../audit';
import { loadBundle, loadProject } from '../bundle';
import { one, pool, q, setClause, tx } from '../db';
import { bad, h, notFound } from '../errors';
import { runEscalations } from '../jobs/escalate';

export const projects = Router();

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date (YYYY-MM-DD)');

projects.get(
  '/me',
  h(async (req, res) => {
    const memberships = await q(
      pool,
      `select p.id, p.name, p.code, pm.role from project_members pm join projects p on p.id = pm.project_id
       where pm.user_id = $1 order by p.name`,
      [req.user!.id],
    );
    res.json({ user: req.user, projects: memberships });
  }),
);

projects.post(
  '/projects',
  h(async (req, res) => {
    const body = z
      .object({ name: z.string().min(1), code: z.string().optional(), timezone: z.string().default('America/Chicago'), workDays: z.number().int().min(5).max(7).default(5) })
      .parse(req.body);
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: body.timezone });
    } catch {
      throw bad('Unknown time zone.');
    }
    const p = await tx(async (c) => {
      const p = await one(c, 'insert into projects (name, code, timezone, work_days) values ($1, $2, $3, $4) returning *', [body.name, body.code ?? null, body.timezone, body.workDays]);
      await c.query(`insert into project_members (project_id, user_id, role) values ($1, $2, 'super')`, [p.id, req.user!.id]);
      return p;
    });
    res.status(201).json(p);
  }),
);

projects.get(
  '/projects/:pid',
  h(async (req, res) => {
    const m = await authorize(req, req.params.pid, 'read');
    res.json(await loadBundle(req.params.pid, m.role));
  }),
);

projects.patch(
  '/projects/:pid',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const body = z.object({ name: z.string().min(1).optional(), code: z.string().nullable().optional(), timezone: z.string().optional(), workDays: z.number().int().min(5).max(7).optional() }).parse(req.body);
    const s = setClause(body, ['name', 'code', 'timezone', 'workDays'], 2);
    if (!s.keys.length) return res.json(await loadProject(req.params.pid));
    res.json(await one(pool, `update projects set ${s.sql}, updated_at = now() where id = $1 returning *`, [req.params.pid, ...s.values]));
  }),
);

/** FR-13 / §8 Monday roll-forward: acknowledges the new week and reports last week's PPC. */
projects.post(
  '/projects/:pid/roll-forward',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const b = await loadBundle(req.params.pid, 'super');
    const thisWeek = weekStart(b.today);
    const lastWeek = addDays(thisWeek, -7);
    await pool.query('update projects set last_rolled_week = $2, updated_at = now() where id = $1', [req.params.pid, thisWeek]);
    await audit(pool, { projectId: req.params.pid, entityType: 'project', entityId: req.params.pid, action: 'roll_forward', changes: { week: thisWeek }, actor: req.user! });
    const last = b.commitments.filter((c) => c.weekStart === lastWeek);
    res.json({
      week: thisWeek,
      lastWeek: ppcByWeek(b.commitments, [lastWeek])[0],
      unmarked: last.filter((c) => c.status === 'confirmed').length,
      variance: varianceBreakdown(last),
    });
  }),
);

// ---------- Members (FR-14) ----------
projects.post(
  '/projects/:pid/members',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const body = z.object({ email: z.string().email(), name: z.string().min(1), role: z.enum(ROLES), tradeId: uuid.nullable().optional() }).parse(req.body);
    const out = await tx(async (c) => {
      const u = await one(
        c,
        `insert into users (email, name) values (lower($1), $2) on conflict (email) do update set name = coalesce(nullif(users.name, ''), excluded.name) returning id`,
        [body.email, body.name],
      );
      await c.query(
        `insert into project_members (project_id, user_id, role, trade_id) values ($1, $2, $3, $4)
         on conflict (project_id, user_id) do update set role = excluded.role, trade_id = excluded.trade_id`,
        [req.params.pid, u.id, body.role, body.tradeId ?? null],
      );
      return u;
    });
    res.status(201).json(out);
  }),
);

projects.patch(
  '/projects/:pid/members/:uid',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const body = z.object({ role: z.enum(ROLES).optional(), tradeId: uuid.nullable().optional() }).parse(req.body);
    if (body.role && body.role !== 'super' && req.params.uid === req.user!.id) {
      const supers = await q(pool, `select 1 from project_members where project_id = $1 and role = 'super'`, [req.params.pid]);
      if (supers.length <= 1) throw bad('A project needs at least one superintendent.');
    }
    const s = setClause(body, ['role', 'tradeId'], 3);
    if (s.keys.length) await pool.query(`update project_members set ${s.sql} where project_id = $1 and user_id = $2`, [req.params.pid, req.params.uid, ...s.values]);
    res.json({ ok: true });
  }),
);

projects.delete(
  '/projects/:pid/members/:uid',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    if (req.params.uid === req.user!.id) throw bad('You cannot remove yourself.');
    await pool.query('delete from project_members where project_id = $1 and user_id = $2', [req.params.pid, req.params.uid]);
    res.json({ ok: true });
  }),
);

// ---------- Trades, areas, systems ----------
const lookups = {
  trades: {
    schema: z.object({ name: z.string().min(1), company: z.string().nullable().optional(), foremanName: z.string().nullable().optional(), foremanEmail: z.string().email().nullable().optional().or(z.literal('').transform(() => null)), foremanPhone: z.string().nullable().optional() }),
    cols: ['name', 'company', 'foremanName', 'foremanEmail', 'foremanPhone'],
  },
  areas: {
    schema: z.object({ name: z.string().min(1), kind: z.enum(AREA_KINDS).optional(), parentId: uuid.nullable().optional() }),
    cols: ['name', 'kind', 'parentId'],
  },
  systems: {
    schema: z.object({ name: z.string().min(1), systemType: z.enum(SYSTEM_TYPES).optional(), areaId: uuid.nullable().optional() }),
    cols: ['name', 'systemType', 'areaId'],
  },
} as const;

for (const [table, def] of Object.entries(lookups)) {
  projects.post(
    `/projects/:pid/${table}`,
    h(async (req, res) => {
      await authorize(req, req.params.pid, 'plan.edit');
      const body = def.schema.parse(req.body) as Record<string, unknown>;
      const s = setClause(body, [...def.cols], 2);
      const cols = s.sql.split(', ').map((x) => x.split(' = ')[0]);
      const row = await one(pool, `insert into ${table} (project_id, ${cols.join(', ')}) values ($1, ${s.keys.map((_, i) => `$${i + 2}`).join(', ')}) returning *`, [req.params.pid, ...s.values]);
      res.status(201).json(row);
    }),
  );
  projects.patch(
    `/${table}/:id`,
    h(async (req, res) => {
      const pid = await projectOf(table, req.params.id);
      await authorize(req, pid, 'plan.edit');
      const body = (def.schema as z.AnyZodObject).partial().parse(req.body);
      const s = setClause(body, [...def.cols], 2);
      if (!s.keys.length) throw bad('Nothing to update.');
      res.json(await one(pool, `update ${table} set ${s.sql} where id = $1 returning *`, [req.params.id, ...s.values]));
    }),
  );
  projects.delete(
    `/${table}/:id`,
    h(async (req, res) => {
      const pid = await projectOf(table, req.params.id);
      await authorize(req, pid, 'plan.edit');
      await pool.query(`delete from ${table} where id = $1`, [req.params.id]);
      res.json({ ok: true });
    }),
  );
}

// ---------- Audit, notifications, metrics ----------
projects.get(
  '/projects/:pid/audit',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'read');
    const { entityType, entityId } = req.query as Record<string, string | undefined>;
    const rows = await q(
      pool,
      `select id, entity_type, entity_id, action, changes, actor_name, created_at from audit_log
       where project_id = $1 and ($2::text is null or entity_type = $2) and ($3::uuid is null or entity_id = $3)
       order by created_at desc limit 200`,
      [req.params.pid, entityType ?? null, entityId ?? null],
    );
    res.json(rows);
  }),
);

projects.get(
  '/notifications',
  h(async (req, res) => {
    res.json(await q(pool, 'select * from notifications where user_id = $1 order by created_at desc limit 50', [req.user!.id]));
  }),
);

projects.post(
  '/notifications/read',
  h(async (req, res) => {
    const ids = z.object({ ids: z.array(uuid).optional() }).parse(req.body).ids;
    await pool.query('update notifications set read_at = now() where user_id = $1 and read_at is null and ($2::uuid[] is null or id = any($2))', [req.user!.id, ids ?? null]);
    res.json({ ok: true });
  }),
);

projects.get(
  '/projects/:pid/metrics',
  h(async (req, res) => {
    const m = await authorize(req, req.params.pid, 'read');
    const b = await loadBundle(req.params.pid, m.role);
    const thisWeek = weekStart(b.today);
    const weeks = weeksInWindow(addDays(thisWeek, -7 * 6), 7); // six closed weeks + this week
    const recent = b.commitments.filter((c) => c.weekStart >= weeks[0] && c.weekStart < thisWeek);
    const taskById = new Map(b.tasks.map((t) => [t.id, t]));
    const actById = new Map(b.activities.map((a) => [a.id, a]));
    const tradeName = new Map(b.trades.map((t) => [t.id, t.name]));
    const areaName = new Map(b.areas.map((a) => [a.id, a.name]));
    const tradeKey = taskTradeKey(b.tasks);
    const windowEnd = addDays(thisWeek, 20);
    const inWindow = b.activities.filter((a) => !a.actualFinish && a.plannedStart <= windowEnd && a.plannedFinish >= thisWeek);
    const staleCutoff = addDays(b.today, -STALE_DAYS);
    const allCommitted = b.commitments.filter((c) => c.weekStart >= weeks[0]);
    res.json({
      today: b.today,
      ppc: {
        weeks: ppcByWeek(b.commitments, weeks),
        byTrade: ppcGrouped(recent, (c) => tradeName.get(tradeKey(c) ?? '') ?? null),
        byArea: ppcGrouped(recent, (c) => areaName.get(actById.get(taskById.get(c.taskId)?.activityId ?? '')?.areaId ?? '') ?? null),
        variance: varianceBreakdown(recent),
      },
      clearance: constraintClearance(b.constraints, b.today),
      rfi: rfiCycle(b.constraints, b.activities),
      delay: startDelay(b.activities, b.today, 6),
      milestones: milestoneVariance(b.milestones),
      readinessMix: {
        ready: inWindow.filter((a) => b.readiness[a.id]?.state === 'ready').length,
        constrained: inWindow.filter((a) => b.readiness[a.id]?.state === 'constrained').length,
        atRisk: inWindow.filter((a) => b.readiness[a.id]?.state === 'at_risk').length,
      },
      health: {
        rolledThisWeek: b.project.lastRolledWeek === thisWeek,
        activitiesInWindow: inWindow.length,
        staleActivities: inWindow.filter((a) => a.updatedAt.slice(0, 10) < staleCutoff).length,
        foremanConfirmationRate: allCommitted.length ? allCommitted.filter((c) => c.status !== 'proposed').length / allCommitted.length : null,
      },
    });
  }),
);

projects.post(
  '/projects/:pid/escalations/run',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    res.json(await runEscalations({ projectId: req.params.pid }));
  }),
);
