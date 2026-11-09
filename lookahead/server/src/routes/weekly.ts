// Weekly Work Plan, commitments, PPC (FR-08, FR-09) and foreman confirm links (FR-08, FR-10).
import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { addDays, CONSTRAINT_CATEGORIES, CATEGORY_LABELS, READINESS_LABELS, VARIANCE_REASONS, weekStart, type Commitment } from '@lookahead/shared';
import { authorize, projectOf } from '../access';
import { audit } from '../audit';
import { loadBundle } from '../bundle';
import { one, pool, q, tx } from '../db';
import { appUrl, sendEmail } from '../email';
import { bad, forbidden, h, HttpError } from '../errors';
import { notify } from '../notify';
import { nextNumber } from './constraints';

export const weekly = Router();
export const foremanPublic = Router();

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const LINK_DAYS = 14;

/** Super pulls READY (or overridden-to-READY) tasks into a week's plan. */
weekly.post(
  '/projects/:pid/commitments',
  h(async (req, res) => {
    const pid = req.params.pid;
    await authorize(req, pid, 'plan.edit');
    const body = z.object({ weekStart: isoDate, taskIds: z.array(uuid).min(1) }).parse(req.body);
    if (weekStart(body.weekStart) !== body.weekStart) throw bad('weekStart must be a Monday.');
    const b = await loadBundle(pid, 'super');
    const tasks = new Map(b.tasks.map((t) => [t.id, t]));
    const created: Commitment[] = [];
    await tx(async (c) => {
      for (const id of body.taskIds) {
        const t = tasks.get(id);
        if (!t) throw bad('Unknown task.');
        const r = b.taskReadiness[id];
        if (r?.state !== 'ready')
          throw bad(`"${t.name}" is ${READINESS_LABELS[r?.state ?? 'constrained']} — clear its constraints or override the activity's readiness first.`);
        const row = await one<Commitment>(
          c,
          `insert into commitments (project_id, week_start, task_id, trade_id, crew_size, promised_start, promised_finish, overridden)
           values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (task_id, week_start) do nothing returning *`,
          [pid, body.weekStart, id, t.tradeId, t.crewSize, t.plannedStart, t.plannedFinish, r.overridden],
        );
        if (row) created.push(row);
      }
    });
    res.status(201).json(created);
  }),
);

const commitmentPatch = z.object({
  crewSize: z.number().int().min(0).nullable().optional(),
  promisedStart: isoDate.nullable().optional(),
  promisedFinish: isoDate.nullable().optional(),
  status: z.enum(['proposed', 'confirmed', 'done', 'not_done']).optional(),
  varianceReason: z.enum(VARIANCE_REASONS).nullable().optional(),
  varianceNote: z.string().nullable().optional(),
});

/** Confirm on behalf of a foreman, or mark Done / Not Done at week end (FR-09). */
weekly.patch(
  '/commitments/:id',
  h(async (req, res) => {
    const pid = await projectOf('commitments', req.params.id);
    const m = await authorize(req, pid, 'commit');
    const body = commitmentPatch.parse(req.body);
    const before = await one<Commitment>(pool, 'select * from commitments where id = $1', [req.params.id]);
    if (!before) throw bad('Not found.');
    if (m.role === 'foreman') {
      if (before.tradeId !== m.tradeId) throw forbidden('That task belongs to another trade.');
      if (body.status === 'done' || body.status === 'not_done') throw forbidden('The super marks tasks Done / Not Done.');
    }
    const status = body.status ?? before.status;
    if (status === 'not_done') {
      const reason = body.varianceReason ?? before.varianceReason;
      if (!reason) throw bad('Pick the reason this task was not done.');
      if (reason === 'other' && !(body.varianceNote ?? before.varianceNote)?.trim()) throw bad('Add a note for "Other".');
    }
    const row = await one<Commitment>(
      pool,
      `update commitments set
         crew_size = coalesce($2, crew_size), promised_start = coalesce($3, promised_start), promised_finish = coalesce($4, promised_finish),
         status = $5,
         confirmed_at = case when $5 in ('confirmed','done','not_done') then coalesce(confirmed_at, now()) else null end,
         confirmed_by_name = case when $5 in ('confirmed','done','not_done') then coalesce(confirmed_by_name, $6) else null end,
         variance_reason = case when $5 = 'not_done' then coalesce($7, variance_reason) else null end,
         variance_note = case when $5 = 'not_done' then coalesce($8, variance_note) else null end,
         marked_at = case when $5 in ('done','not_done') then now() else null end
       where id = $1 returning *`,
      [req.params.id, body.crewSize ?? null, body.promisedStart ?? null, body.promisedFinish ?? null, status, req.user!.name, body.varianceReason ?? null, body.varianceNote ?? null],
    );
    if (status !== before.status)
      await audit(pool, { projectId: pid, entityType: 'commitment', entityId: row!.id, action: `status_${status}`, changes: { status: { from: before.status, to: status }, varianceReason: row!.varianceReason }, actor: req.user! });
    res.json(row);
  }),
);

weekly.delete(
  '/commitments/:id',
  h(async (req, res) => {
    const pid = await projectOf('commitments', req.params.id);
    await authorize(req, pid, 'plan.edit');
    const c = await one(pool, 'select status from commitments where id = $1', [req.params.id]);
    if (c && ['done', 'not_done'].includes(c.status)) throw bad('This task is already marked; it counts toward PPC and cannot be removed.');
    await pool.query('delete from commitments where id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);

// ---------- Foreman links: confirm without an account ----------
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

weekly.get(
  '/projects/:pid/foreman-links',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    res.json(await q(pool, `select id, trade_id, week_start, expires_at, revoked_at, created_at from foreman_links where project_id = $1 and revoked_at is null and expires_at > now() order by created_at desc`, [req.params.pid]));
  }),
);

weekly.post(
  '/projects/:pid/foreman-links',
  h(async (req, res) => {
    const pid = req.params.pid;
    await authorize(req, pid, 'plan.edit');
    const body = z.object({ tradeId: uuid, weekStart: isoDate, send: z.boolean().default(false) }).parse(req.body);
    const trade = await one(pool, 'select * from trades where id = $1 and project_id = $2', [body.tradeId, pid]);
    if (!trade) throw bad('Unknown trade.');
    const token = randomBytes(24).toString('base64url');
    const link = await one(
      pool,
      `insert into foreman_links (project_id, trade_id, week_start, token_hash, expires_at, created_by) values ($1, $2, $3, $4, now() + interval '${LINK_DAYS} days', $5) returning id, expires_at`,
      [pid, body.tradeId, body.weekStart, hash(token), req.user!.id],
    );
    const url = `${appUrl()}/f/${token}`;
    let sent = false;
    if (body.send) {
      if (!trade.foremanEmail) throw bad(`Add a foreman email for ${trade.name} first, or copy the link instead.`);
      const p = await one(pool, 'select name from projects where id = $1', [pid]);
      sent = await sendEmail(
        trade.foremanEmail,
        `${p.name}: confirm your crew for the week of ${body.weekStart}`,
        `Hi ${trade.foremanName ?? ''},\n\n${req.user!.name} has planned ${trade.name} work for the week of ${body.weekStart}.\nPlease confirm your crew size and dates, and flag anything that could stop the work:\n\n${url}\n\nNo account needed. This link expires in ${LINK_DAYS} days.\n`,
      );
    }
    await audit(pool, { projectId: pid, entityType: 'foreman_link', entityId: link.id, action: 'create', changes: { tradeId: body.tradeId, weekStart: body.weekStart, sent }, actor: req.user! });
    res.status(201).json({ id: link.id, url, expiresAt: link.expiresAt, sent });
  }),
);

weekly.post(
  '/foreman-links/:id/revoke',
  h(async (req, res) => {
    const pid = await projectOf('foreman_links', req.params.id);
    await authorize(req, pid, 'plan.edit');
    await pool.query('update foreman_links set revoked_at = now() where id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);

async function resolveLink(token: string) {
  const l = await one(pool, 'select * from foreman_links where token_hash = $1', [hash(token)]);
  if (!l || l.revokedAt) throw new HttpError(404, 'This link is no longer valid. Ask your superintendent for a new one.');
  if (new Date(l.expiresAt) < new Date()) throw new HttpError(410, 'This link has expired. Ask your superintendent for a new one.');
  return l as { id: string; projectId: string; tradeId: string; weekStart: string };
}

foremanPublic.get(
  '/f/:token',
  h(async (req, res) => {
    const l = await resolveLink(req.params.token);
    const b = await loadBundle(l.projectId, 'foreman');
    const trade = b.trades.find((t) => t.id === l.tradeId)!;
    const actById = new Map(b.activities.map((a) => [a.id, a]));
    const areaName = new Map(b.areas.map((a) => [a.id, a.name]));
    const commitments = b.commitments.filter((c) => c.weekStart === l.weekStart && c.tradeId === l.tradeId);
    const committedTaskIds = new Set(commitments.map((c) => c.taskId));
    const windowEnd = addDays(l.weekStart, 20);
    // Upcoming tasks for this trade (next 3 weeks) so the foreman can flag problems early (FR-10).
    const upcoming = b.tasks.filter((t) => t.tradeId === l.tradeId && !committedTaskIds.has(t.id) && t.plannedStart <= windowEnd && t.plannedFinish >= l.weekStart);
    const view = (t: (typeof b.tasks)[number]) => {
      const a = actById.get(t.activityId);
      const r = b.taskReadiness[t.id];
      return {
        id: t.id, name: t.name, activityName: a?.name ?? '', area: areaName.get(a?.areaId ?? '') ?? null,
        plannedStart: t.plannedStart, plannedFinish: t.plannedFinish, crewSize: t.crewSize,
        readiness: r?.state ?? 'ready', reasons: (r?.reasons ?? []).map((x) => x.text),
        openConstraints: b.constraints.filter((c) => c.activityId === t.activityId && (!c.taskId || c.taskId === t.id) && ['raised', 'open', 'promised'].includes(c.status)).map((c) => ({ id: c.id, number: c.number, description: c.description, status: c.status, neededBy: c.neededBy })),
      };
    };
    res.json({
      project: { name: b.project.name },
      trade: { name: trade.name, company: trade.company, foremanName: trade.foremanName },
      weekStart: l.weekStart,
      commitments: commitments.map((c) => ({ ...c, task: view(b.tasks.find((t) => t.id === c.taskId)!) })),
      upcoming: upcoming.map(view),
      categories: CONSTRAINT_CATEGORIES.map((k) => ({ key: k, label: CATEGORY_LABELS[k] })),
    });
  }),
);

foremanPublic.post(
  '/f/:token/commitments/:cid/confirm',
  h(async (req, res) => {
    const l = await resolveLink(req.params.token);
    const body = z.object({ crewSize: z.number().int().min(0), promisedStart: isoDate.optional(), promisedFinish: isoDate.optional(), name: z.string().trim().min(1).max(80) }).parse(req.body);
    const c = await one<Commitment>(pool, 'select * from commitments where id = $1', [req.params.cid]);
    if (!c || c.projectId !== l.projectId || c.tradeId !== l.tradeId || c.weekStart !== l.weekStart) throw new HttpError(404, 'Task not found.');
    if (c.status === 'done' || c.status === 'not_done') throw bad('This week is already closed out.');
    const row = await one(
      pool,
      `update commitments set crew_size = $2, promised_start = coalesce($3, promised_start), promised_finish = coalesce($4, promised_finish),
         status = 'confirmed', confirmed_at = now(), confirmed_by_name = $5 where id = $1 returning *`,
      [c.id, body.crewSize, body.promisedStart ?? null, body.promisedFinish ?? null, body.name],
    );
    await audit(pool, { projectId: l.projectId, entityType: 'commitment', entityId: c.id, action: 'confirmed_by_link', changes: { crewSize: body.crewSize }, actor: { name: `${body.name} (foreman link)` } });
    res.json(row);
  }),
);

/** FR-10: raise a constraint from a task in two taps. It arrives as 'raised' for the super to own and date. */
foremanPublic.post(
  '/f/:token/constraints',
  h(async (req, res) => {
    const l = await resolveLink(req.params.token);
    const body = z.object({ taskId: uuid, category: z.enum(CONSTRAINT_CATEGORIES), note: z.string().trim().max(500).optional(), name: z.string().trim().max(80).optional() }).parse(req.body);
    const t = await one(pool, 'select * from tasks where id = $1', [body.taskId]);
    if (!t || t.projectId !== l.projectId || t.tradeId !== l.tradeId) throw new HttpError(404, 'Task not found.');
    const trade = await one(pool, 'select name, foreman_name from trades where id = $1', [l.tradeId]);
    const who = body.name || trade.foremanName || `${trade.name} foreman`;
    const row = await tx(async (c) => {
      const n = await nextNumber(c, l.projectId);
      const desc = body.note ? body.note : `${CATEGORY_LABELS[body.category]} — flagged by ${trade.name} on "${t.name}"`;
      const row = await one(
        c,
        `insert into constraints (project_id, number, description, category, activity_id, task_id, needed_by, status, raised_by_name)
         values ($1, $2, $3, $4, $5, $6, $7, 'raised', $8) returning *`,
        [l.projectId, n, desc, body.category, t.activityId, t.id, addDays(t.plannedStart, -1), who],
      );
      await audit(c, { projectId: l.projectId, entityType: 'constraint', entityId: row.id, action: 'raised_by_link', changes: { category: body.category }, actor: { name: `${who} (foreman link)` } });
      const supers = await q(c, `select user_id from project_members where project_id = $1 and role = 'super'`, [l.projectId]);
      await notify(c, {
        projectId: l.projectId, userIds: supers.map((s) => s.userId), kind: 'constraint_raised', entityType: 'constraint', entityId: row.id,
        title: `${who} flagged #${n}: ${CATEGORY_LABELS[body.category]} on "${t.name}"`,
        body: `${desc}\nNeeds an owner and needed-by date.`, link: `/p/${l.projectId}/constraints?c=${row.id}`,
      });
      return row;
    });
    res.status(201).json({ id: row.id, number: row.number });
  }),
);

