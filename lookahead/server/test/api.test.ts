import { readFileSync } from 'node:fs';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { addDays, type ProjectBundle } from '@lookahead/shared';
import { createApp } from '../src/app';
import { pool, q } from '../src/db';
import { runEscalations } from '../src/jobs/escalate';
import { parseXer } from '../src/import/p6';
import { seed } from '../src/seed';

const app = createApp();
let pid: string;
let users: Record<string, string>;
const as = (name: string) => ({ 'x-dev-user': users[name] });
const bundle = async (who = 'Sam Rivera') => (await request(app).get(`/api/projects/${pid}`).set(as(who)).expect(200)).body as ProjectBundle;

beforeAll(async () => {
  const s = await seed({ quiet: true });
  pid = s.pid;
  users = s.users;
});

describe('access (FR-14)', () => {
  it('requires sign-in and hides other projects', async () => {
    await request(app).get(`/api/projects/${pid}`).expect(401);
    const [{ id }] = await q(pool, `insert into users (email, name) values ('outsider@example.com', 'Outsider') returning id`);
    await request(app).get(`/api/projects/${pid}`).set({ 'x-dev-user': id }).expect(404);
  });
  it('owner viewer is read-only', async () => {
    const b = await bundle('Taylor Brooks');
    expect(b.myRole).toBe('owner_viewer');
    const a = b.activities[0];
    await request(app).patch(`/api/activities/${a.id}`).set(as('Taylor Brooks')).send({ crewSize: 3 }).expect(403);
    await request(app).post(`/api/projects/${pid}/constraints`).set(as('Taylor Brooks')).send({ description: 'x', category: 'rfi', ownerUserId: users['Priya Shah'], neededBy: '2026-12-01' }).expect(403);
  });
  it('PM can edit own constraints but not others or reassign', async () => {
    const b = await bundle();
    const mine = b.constraints.find((c) => c.ownerUserId === users['Priya Shah'] && c.status === 'open')!;
    const notMine = b.constraints.find((c) => c.ownerUserId === users['Jordan Lee'] && c.status === 'open')!;
    await request(app).patch(`/api/constraints/${mine.id}`).set(as('Priya Shah')).send({ promisedDate: mine.neededBy }).expect(200);
    await request(app).patch(`/api/constraints/${notMine.id}`).set(as('Priya Shah')).send({ promisedDate: notMine.neededBy }).expect(403);
    await request(app).patch(`/api/constraints/${mine.id}`).set(as('Priya Shah')).send({ ownerUserId: users['Jordan Lee'] }).expect(403);
  });
});

describe('constraints (FR-03..FR-05)', () => {
  it('rejects a constraint without owner or needed-by, in one sentence (FR-04)', async () => {
    const res = await request(app).post(`/api/projects/${pid}/constraints`).set(as('Sam Rivera')).send({ description: 'Vendor booked', category: 'vendor_startup' }).expect(400);
    expect(res.body.error).toMatch(/owner and a needed-by date/);
  });
  it('walks the lifecycle open → promised → cleared and makes the activity READY', async () => {
    const b = await bundle();
    const a = b.activities.find((x) => x.name.startsWith('Install and terminate fire alarm devices'))!;
    const created = await request(app).post(`/api/projects/${pid}/constraints`).set(as('Sam Rivera'))
      .send({ description: 'Ceiling grid access in DH2', category: 'access_space', activityId: a.id, ownerUserId: users['Jordan Lee'], neededBy: addDays(a.plannedStart, -1) }).expect(201);
    expect(created.body.status).toBe('open');
    const p = await request(app).patch(`/api/constraints/${created.body.id}`).set(as('Jordan Lee')).send({ promisedDate: addDays(a.plannedStart, -2) }).expect(200);
    expect(p.body.status).toBe('promised');
    const noNote = await request(app).patch(`/api/constraints/${created.body.id}`).set(as('Jordan Lee')).send({ status: 'cleared' }).expect(400);
    expect(noNote.body.error).toMatch(/note/);
    const cleared = await request(app).patch(`/api/constraints/${created.body.id}`).set(as('Jordan Lee')).send({ status: 'cleared', clearanceNote: 'Walked it' }).expect(200);
    expect(cleared.body.clearedAt).toBeTruthy();
    const audit = await request(app).get(`/api/projects/${pid}/audit?entityType=constraint&entityId=${created.body.id}`).set(as('Sam Rivera')).expect(200);
    expect(audit.body.map((x: any) => x.action)).toEqual(expect.arrayContaining(['create', 'status_promised', 'status_cleared']));
  });
  it('escalations fire once per level and auto-miss overdue constraints', async () => {
    const b = await bundle();
    const c = b.constraints.find((x) => x.status === 'open' && x.ownerUserId)!;
    await pool.query(`update constraints set needed_by = $2 where id = $1`, [c.id, addDays(b.today, -3)]);
    await pool.query(`delete from escalations where constraint_id = $1`, [c.id]);
    const first = await runEscalations({ projectId: pid });
    expect(first.missed).toBeGreaterThanOrEqual(1);
    const lv = await q(pool, 'select level from escalations where constraint_id = $1 order by level', [c.id]);
    expect(lv.map((x) => x.level)).toEqual(['pm_overdue_2d', 'super_due']);
    const again = await runEscalations({ projectId: pid });
    expect(again.notifications).toBe(0);
    const after = await bundle();
    expect(after.constraints.find((x) => x.id === c.id)!.status).toBe('missed');
    if (c.activityId) expect(after.readiness[c.activityId].state).toBe('at_risk');
  });
});

describe('readiness override (§6, NFR-03)', () => {
  it('requires a note and is logged', async () => {
    const b = await bundle();
    const a = b.activities.find((x) => b.readiness[x.id].state !== 'ready' && !x.actualFinish)!;
    await request(app).post(`/api/activities/${a.id}/override`).set(as('Sam Rivera')).send({ state: 'ready' }).expect(400);
    await request(app).post(`/api/activities/${a.id}/override`).set(as('Sam Rivera')).send({ state: 'ready', note: 'Vendor confirmed by phone' }).expect(200);
    const after = await bundle();
    expect(after.readiness[a.id]).toMatchObject({ state: 'ready', overridden: true });
    await request(app).post(`/api/activities/${a.id}/override`).set(as('Sam Rivera')).send({ state: null }).expect(200);
  });
});

describe('weekly work plan, foreman link, PPC (FR-08..FR-10)', () => {
  it('only READY tasks can be committed', async () => {
    const b = await bundle();
    const notReady = b.tasks.find((t) => b.taskReadiness[t.id]?.state !== 'ready')!;
    const res = await request(app).post(`/api/projects/${pid}/commitments`).set(as('Sam Rivera')).send({ weekStart: addDays(b.project.lastRolledWeek!, 14), taskIds: [notReady.id] }).expect(400);
    expect(res.body.error).toMatch(/clear its constraints or override/);
  });
  it('foreman confirms by link and flags a constraint in two taps, then super marks done / not done', async () => {
    const b = await bundle();
    const elec = b.trades.find((t) => t.name === 'Electrical')!;
    const week = addDays(b.project.lastRolledWeek!, 14);
    const task = b.tasks.find((t) => t.tradeId === elec.id && t.plannedStart > b.today && b.taskReadiness[t.id]?.state === 'ready' && !b.commitments.some((c) => c.taskId === t.id))!;
    expect(task).toBeTruthy();
    const [cm] = (await request(app).post(`/api/projects/${pid}/commitments`).set(as('Sam Rivera')).send({ weekStart: week, taskIds: [task.id] }).expect(201)).body;
    const link = (await request(app).post(`/api/projects/${pid}/foreman-links`).set(as('Sam Rivera')).send({ tradeId: elec.id, weekStart: week }).expect(201)).body;
    const token = link.url.split('/f/')[1];
    const view = (await request(app).get(`/api/f/${token}`).expect(200)).body;
    expect(view.trade.name).toBe('Electrical');
    expect(view.commitments).toHaveLength(1);
    await request(app).post(`/api/f/${token}/commitments/${cm.id}/confirm`).send({ crewSize: 6, name: 'Marcus Cole' }).expect(200);
    const flag = await request(app).post(`/api/f/${token}/constraints`).send({ taskId: task.id, category: 'material_equipment' }).expect(201);
    const raised = (await bundle()).constraints.find((c) => c.id === flag.body.id)!;
    expect(raised.status).toBe('raised');
    expect(raised.ownerUserId).toBeNull();
    // A raised constraint without owner makes the task AT RISK until the super owns and dates it.
    expect((await bundle()).taskReadiness[task.id].state).toBe('at_risk');
    await request(app).patch(`/api/constraints/${raised.id}`).set(as('Sam Rivera')).send({ ownerUserId: users['Jordan Lee'], neededBy: addDays(task.plannedStart, -1) }).expect(200);
    // other trades' tasks are not reachable through this link
    const other = b.tasks.find((t) => t.tradeId && t.tradeId !== elec.id)!;
    await request(app).post(`/api/f/${token}/constraints`).send({ taskId: other.id, category: 'labor_crew' }).expect(404);
    await request(app).patch(`/api/commitments/${cm.id}`).set(as('Sam Rivera')).send({ status: 'not_done' }).expect(400);
    const marked = await request(app).patch(`/api/commitments/${cm.id}`).set(as('Sam Rivera')).send({ status: 'not_done', varianceReason: 'material' }).expect(200);
    expect(marked.body.status).toBe('not_done');
    await request(app).post(`/api/foreman-links/${link.id}/revoke`).set(as('Sam Rivera')).expect(200);
    await request(app).get(`/api/f/${token}`).expect(404);
  });
  it('reports PPC and the other §10 metrics', async () => {
    const m = (await request(app).get(`/api/projects/${pid}/metrics`).set(as('Taylor Brooks')).expect(200)).body;
    const closed = m.ppc.weeks.filter((w: any) => w.ppc !== null);
    expect(closed.length).toBeGreaterThanOrEqual(5);
    expect(closed.at(-1).ppc).toBeCloseTo(7 / 8);
    expect(m.rfi.cleared).toBeGreaterThanOrEqual(2);
    expect(m.clearance.total).toBeGreaterThan(10);
  });
});

describe('imports (FR-15, D-1)', () => {
  it('previews then imports CSV activities and reports row errors', async () => {
    const csv = 'id,name,area,system,trade,start,finish,crew_size,cx_level,predecessors\nX1,Hang tray,Data Hall 1,,Electrical,11/30/2026,12/2/2026,4,2,\nX2,Pull cable,Data Hall 1,,Electrical,2026-12-03,2026-12-04,4,2,X1\nX3,Bad row,,,,not a date,2026-12-04,,,\n';
    const prev = (await request(app).post(`/api/projects/${pid}/import/csv`).set(as('Sam Rivera')).send({ kind: 'activities', content: csv }).expect(200)).body;
    expect(prev.counts.activities).toBe(2);
    expect(prev.errors[0]).toMatchObject({ row: 4 });
    const done = (await request(app).post(`/api/projects/${pid}/import/csv`).set(as('Sam Rivera')).send({ kind: 'activities', content: csv, commit: true }).expect(200)).body;
    expect(done.result.activities.created).toBe(2);
    const again = (await request(app).post(`/api/projects/${pid}/import/csv`).set(as('Sam Rivera')).send({ kind: 'activities', content: csv, commit: true }).expect(200)).body;
    expect(again.result.activities).toEqual({ created: 0, updated: 2 });
    const b = await bundle();
    const x2 = b.activities.find((a) => a.externalRef === 'X2')!;
    expect(x2.predecessorIds).toHaveLength(1);
    expect(b.tasks.filter((t) => t.activityId === x2.id)).toHaveLength(1);
  });
  it('parses a P6 XER: window, codes, WBS, predecessors, milestones', () => {
    const plan = parseXer(readFileSync(new URL('./fixtures/sample.xer', import.meta.url), 'utf8'), { from: '2026-11-09', to: '2027-01-31' });
    expect(plan.errors).toEqual([]);
    expect(plan.activities.map((a) => a.ref)).toEqual(['EL-1000', 'EL-1010', 'ME-2000']);
    expect(plan.activities[0]).toMatchObject({ area: 'Electrical Room B', trade: 'Electrical', system: 'UPS Plant B', cxLevel: 2, start: '2026-11-16', finish: '2026-11-20' });
    expect(plan.activities[1].predecessorRefs).toEqual(['EL-1000']);
    expect(plan.activities[2].predecessorRefs).toEqual([]); // predecessor outside window dropped
    expect(plan.milestones).toEqual([{ name: 'Energize UPS Plant B', targetDate: '2026-12-01', ref: 'MS-1' }]);
  });
  it('imports a P6 file through the API', async () => {
    const content = readFileSync(new URL('./fixtures/sample.xer', import.meta.url), 'utf8');
    const res = (await request(app).post(`/api/projects/${pid}/import/p6`).set(as('Sam Rivera')).send({ content, filename: 'dc2.xer', from: '2026-11-09', to: '2027-01-31', commit: true }).expect(200)).body;
    expect(res.result.activities.created).toBe(3);
    expect(res.result.milestones.created).toBe(1);
  });
});
