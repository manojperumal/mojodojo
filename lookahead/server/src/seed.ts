// Sample data center project (decision D-4), based on PRD Appendix A.
// Dates are relative to today so the demo always looks live. Usage: npm run seed  (wipes all data!)
import 'dotenv/config';
import { addDays, todayIn, weekStart } from '@lookahead/shared';
import { fileURLToPath } from 'node:url';
import { loadBundle } from './bundle';
import { one, pool, q, tx } from './db';
import { applyTemplate } from './import/apply';
import { runEscalations } from './jobs/escalate';
import { migrate } from './migrate';

const TZ = 'America/Chicago';

export async function seed({ quiet = false } = {}) {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--yes-wipe-production'))
    throw new Error('Refusing to seed: this wipes ALL data. Pass --yes-wipe-production if you really mean it.');
  await migrate(false);
  const today = todayIn(TZ);
  const T = weekStart(today);
  const d = (n: number) => addDays(today, n); // relative to today
  const w = (n: number) => addDays(T, n); // relative to this week's Monday

  const result = await tx(async (c) => {
    await c.query(`truncate users, projects, audit_log restart identity cascade`);

    const people = [
      ['Sam Rivera', 'sam.rivera@example.com', 'super'],
      ['Priya Shah', 'priya.shah@example.com', 'pm'],
      ['Jordan Lee', 'jordan.lee@example.com', 'field_engineer'],
      ['Marcus Cole', 'marcus.cole@example.com', 'foreman'],
      ['Dana Ortiz', 'dana.ortiz@example.com', 'foreman'],
      ['Alex Kim', 'alex.kim@example.com', 'cxa'],
      ['Taylor Brooks', 'taylor.brooks@example.com', 'owner_viewer'],
    ] as const;
    const u: Record<string, string> = {};
    for (const [name, email] of people) u[name] = (await one(c, 'insert into users (name, email) values ($1, $2) returning id', [name, email])).id;

    const p = await one(c, `insert into projects (name, code, timezone, work_days, last_rolled_week) values ($1, $2, $3, 6, $4) returning id`, ['DC-2 Data Center — Pre-commissioning (sample)', 'DC2', TZ, w(-7)]);
    const pid: string = p.id;

    const trades: Record<string, string> = {};
    for (const [name, company, fn, fe] of [
      ['Electrical', 'Volt Electric', 'Marcus Cole', 'marcus.cole@example.com'],
      ['Mechanical', 'Apex Mechanical', 'Dana Ortiz', 'dana.ortiz@example.com'],
      ['Controls', 'Delta Controls', 'Lee Park', 'lee.park@example.com'],
      ['Fire Alarm', 'Beacon Fire & Life Safety', 'Rosa Diaz', 'rosa.diaz@example.com'],
      ['UPS Vendor', 'Vertex Power Services', 'Field service', null],
      ['Generator Vendor', 'Northline Power Systems', 'Field service', null],
      ['Testing Agency', 'Meridian Electrical Testing', null, null],
      ['TAB', 'Precision Balance', null, null],
    ] as const)
      trades[name] = (await one(c, 'insert into trades (project_id, name, company, foreman_name, foreman_email) values ($1,$2,$3,$4,$5) returning id', [pid, name, company, fn, fe])).id;

    for (const [name, , role] of people)
      await c.query('insert into project_members (project_id, user_id, role, trade_id) values ($1, $2, $3, $4)', [pid, u[name], role, name === 'Marcus Cole' ? trades.Electrical : name === 'Dana Ortiz' ? trades.Mechanical : null]);

    const areas: Record<string, string> = {};
    for (const [name, kind] of [['Building A', 'building'], ['Data Hall 1', 'data_hall'], ['Data Hall 2', 'data_hall'], ['Electrical Room B', 'room'], ['Central Plant', 'zone'], ['Generator Yard', 'zone']] as const)
      areas[name] = (await one(c, 'insert into areas (project_id, name, kind, parent_id) values ($1,$2,$3,$4) returning id', [pid, name, kind, name === 'Building A' ? null : null])).id;
    await c.query(`update areas set parent_id = $1 where project_id = $2 and name <> 'Building A'`, [areas['Building A'], pid]);

    const systems: Record<string, string> = {};
    for (const [name, type, area] of [
      ['UPS Plant B', 'ups', 'Electrical Room B'],
      ['Switchgear Lineup B', 'switchgear', 'Electrical Room B'],
      ['Generator Plant', 'generator', 'Generator Yard'],
      ['CRAH / CHW — Data Hall 2', 'crah_chw', 'Data Hall 2'],
      ['Fire Alarm — Data Hall 2', 'fire_alarm', 'Data Hall 2'],
    ] as const)
      systems[name] = (await one(c, 'insert into systems (project_id, name, system_type, area_id) values ($1,$2,$3,$4) returning id', [pid, name, type, areas[area]])).id;

    for (const [tag, desc, vendor, sys, req, prom, act, su, wit] of [
      ['UPS-B1', 'UPS module B1 — 1.2 MW', 'Vertex Power', 'UPS Plant B', d(-4), d(-5), d(-5), true, true],
      ['UPS-B2', 'UPS module B2 — 1.2 MW', 'Vertex Power', 'UPS Plant B', d(-4), d(-4), d(-3), true, true],
      ['BATT-B', 'Battery cabinets B (6)', 'Vertex Power', 'UPS Plant B', d(-4), d(-6), d(-6), false, false],
      ['SWGR-B', 'Main switchgear lineup B', 'Eaton', 'Switchgear Lineup B', d(-14), d(-15), d(-16), true, true],
      ['GEN-1', 'Generator 1 — 3 MW', 'Northline', 'Generator Plant', d(14), d(10), null, true, true],
      ['GEN-2', 'Generator 2 — 3 MW', 'Northline', 'Generator Plant', d(14), d(12), null, true, true],
      ['GEN-3', 'Generator 3 — 3 MW', 'Northline', 'Generator Plant', d(14), d(19), null, true, true],
      ['CRAH-2-01..08', 'CRAH units 1–8, Data Hall 2', 'Stulz', 'CRAH / CHW — Data Hall 2', d(-24), d(-25), d(-25), true, false],
      ['FACP-2', 'Fire alarm control panel DH2', 'Notifier', 'Fire Alarm — Data Hall 2', d(3), d(2), null, false, false],
    ] as const)
      await c.query(
        `insert into equipment (project_id, tag, description, vendor, system_id, required_on_site, promised_delivery, actual_delivery, startup_needed, witness_needed) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [pid, tag, desc, vendor, systems[sys], req, prom, act, su, wit],
      );

    const actor = { id: u['Sam Rivera'], name: 'Sam Rivera' };
    await applyTemplate(c, pid, { templateKey: 'switchgear', systemId: systems['Switchgear Lineup B'], anchorDate: d(-7) }, actor);
    await applyTemplate(c, pid, { templateKey: 'ups', systemId: systems['UPS Plant B'], anchorDate: d(3) }, actor);
    await applyTemplate(c, pid, { templateKey: 'crah_chw', systemId: systems['CRAH / CHW — Data Hall 2'], anchorDate: d(-13) }, actor);
    await applyTemplate(c, pid, { templateKey: 'generator', systemId: systems['Generator Plant'], anchorDate: d(21) }, actor);
    await applyTemplate(c, pid, { templateKey: 'fire_alarm', systemId: systems['Fire Alarm — Data Hall 2'], anchorDate: d(7) }, actor);

    const act = async (like: string) => (await one(c, `select * from activities where project_id = $1 and name ilike $2`, [pid, like]))!;

    // CRAH story (Appendix A): last week's pre-functional checks split into 8 crew tasks; CRAH 8 missed on the piping flush.
    const crahPfc = await act('Pre-functional checklists (L2) — CRAH units%');
    await c.query('update activities set planned_start = $2, planned_finish = $3, trade_id = $4, crew_size = 6 where id = $1', [crahPfc.id, w(-7), w(-3), trades.Electrical]);
    await c.query('delete from tasks where activity_id = $1', [crahPfc.id]);
    const crahTasks: string[] = [];
    for (let i = 1; i <= 8; i++)
      crahTasks.push((await one(c, `insert into tasks (project_id, activity_id, name, trade_id, crew_size, planned_start, planned_finish) values ($1,$2,$3,$4,6,$5,$6) returning id`, [pid, crahPfc.id, `Pre-functional checklist — CRAH-2-0${i}`, trades.Electrical, w(-7), w(-3)])).id);
    for (const [like, s, f] of [['Start-up and rotation checks%', 3, 5], ['Test, adjust and balance%', 6, 9]] as const) {
      const a = await act(like);
      await c.query('update activities set planned_start = $2, planned_finish = $3 where id = $1', [a.id, d(s), d(f)]);
      await c.query('update tasks set planned_start = $2, planned_finish = $3 where activity_id = $1', [a.id, d(s), d(f)]);
    }

    // Earlier-phase work, for PPC history (6 closed weeks).
    const history = [
      ['Pull feeders — Data Hall 2 PDUs', 'Electrical', 'Data Hall 2'],
      ['Terminate and megger PDU feeders', 'Electrical', 'Data Hall 2'],
      ['Install cable tray — Electrical Room B', 'Electrical', 'Electrical Room B'],
      ['CHW piping insulation — Data Hall 2', 'Mechanical', 'Data Hall 2'],
      ['Hang CHW branch piping — Data Hall 2', 'Mechanical', 'Data Hall 2'],
      ['Install BMS controllers — Central Plant', 'Controls', 'Central Plant'],
      ['Fire alarm conduit rough-in — DH2', 'Fire Alarm', 'Data Hall 2'],
      ['Grounding and bonding — Generator Yard', 'Electrical', 'Generator Yard'],
    ] as const;
    const reasons = ['predecessor', 'material', 'labor', 'design_rfi', 'inspection', 'equipment'];
    const doneCounts = [5, 5, 6, 6, 7];
    for (let wk = -6; wk <= -2; wk++) {
      const ws = w(wk * 7);
      for (let i = 0; i < history.length; i++) {
        const [name, trade, area] = history[i];
        const ok = i < doneCounts[wk + 6];
        const a = await one(c, `insert into activities (project_id, name, area_id, trade_id, planned_start, planned_finish, actual_start, actual_finish, crew_size, cx_level) values ($1,$2,$3,$4,$5,$6,$7,$8,4,null) returning id`,
          [pid, `${name} (wk ${wk + 7})`, areas[area], trades[trade], ws, addDays(ws, 4), i % 5 === 4 ? addDays(ws, 1) : ws, ok ? addDays(ws, 4) : addDays(ws, 8)]);
        const t = await one(c, `insert into tasks (project_id, activity_id, name, trade_id, crew_size, planned_start, planned_finish) values ($1,$2,$3,$4,4,$5,$6) returning id`, [pid, a.id, name, trades[trade], ws, addDays(ws, 4)]);
        await c.query(
          `insert into commitments (project_id, week_start, task_id, trade_id, crew_size, promised_start, promised_finish, status, confirmed_at, confirmed_by_name, variance_reason, marked_at)
           values ($1,$2,$3,$4,4,$5,$6,$7,$8,'Seed',$9,$8)`,
          [pid, ws, t.id, trades[trade], ws, addDays(ws, 4), ok ? 'done' : 'not_done', addDays(ws, -2) + 'T15:00:00Z', ok ? null : reasons[(i + wk + 6) % reasons.length]],
        );
      }
    }
    // Last week: 7 of 8 CRAH checklists done, CRAH 8 missed (predecessor) → 87.5%.
    for (let i = 0; i < 8; i++)
      await c.query(
        `insert into commitments (project_id, week_start, task_id, trade_id, crew_size, promised_start, promised_finish, status, confirmed_at, confirmed_by_name, variance_reason, variance_note, marked_at)
         values ($1,$2,$3,$4,6,$5,$6,$7,$8,'Marcus Cole',$9,$10,now())`,
        [pid, w(-7), crahTasks[i], trades.Electrical, w(-7), w(-3), i < 7 ? 'done' : 'not_done', w(-9) + 'T15:00:00Z', i < 7 ? null : 'predecessor', i < 7 ? null : 'Piping flush incomplete on CRAH-2-08'],
      );
    await c.query('update activities set actual_start = $2 where id = $1', [crahPfc.id, w(-7)]);

    // Constraint states: past-due ones were cleared (mostly early); then Appendix A specifics.
    await c.query(
      `update constraints set status = 'cleared', cleared_at = (needed_by - ((number % 4) || ' days')::interval + interval '15 hours'),
         cleared_by = owner_user_id, clearance_note = 'Confirmed', raised_at = needed_by - interval '16 days'
       where project_id = $1 and needed_by < $2`,
      [pid, today],
    );
    await c.query(`update constraints set raised_at = least(raised_at, needed_by - interval '14 days') where project_id = $1`, [pid]);

    const con = async (like: string) => (await one(c, `select * from constraints where project_id = $1 and description ilike $2`, [pid, like]))!;
    const vendorTech = await con('UPS vendor start-up technician booked%');
    await c.query(`update constraints set needed_by = $2, status = 'open', cleared_at = null, cleared_by = null, clearance_note = null where id = $1`, [vendorTech.id, d(4)]);
    const ahj = await con('AHJ electrical inspection passed — UPS Plant B');
    await c.query(`update constraints set needed_by = $2, promised_date = $3, status = 'promised' where id = $1`, [ahj.id, d(8), d(7)]);
    const loadBank = await con('Load-bank rental confirmed%');
    await c.query(`update constraints set status = 'cleared', cleared_at = $2::date + interval '14 hours', cleared_by = owner_user_id, clearance_note = 'PO 4471 issued, delivery booked' where id = $1`, [loadBank.id, d(-2)]);
    const coord = await con('Coordination study and breaker settings approved%');
    await c.query(`update constraints set status = 'promised', promised_date = $2, cleared_at = null, cleared_by = null, clearance_note = null, needed_by = $3 where id = $1`, [coord.id, d(5), d(2)]);

    const crahStartup = await act('Start-up and rotation checks%');
    const crahStartTask = await one(c, 'select id from tasks where activity_id = $1', [crahStartup.id]);
    let n = (await one(c, 'select max(number) as n from constraints where project_id = $1', [pid])).n;
    const addCon = async (o: { description: string; category: string; activityId?: string | null; taskId?: string | null; owner?: string | null; neededBy?: string | null; status: string; refNumber?: string; raisedAt: string; clearedAt?: string; raisedByName?: string; variance?: string }) =>
      c.query(
        `insert into constraints (project_id, number, description, category, activity_id, task_id, owner_user_id, needed_by, status, ref_number, raised_at, cleared_at, cleared_by, clearance_note, raised_by_name, missed_at, variance_reason)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$7,$13,$14,$15,$16)`,
        [pid, ++n, o.description, o.category, o.activityId ?? null, o.taskId ?? null, o.owner ?? null, o.neededBy ?? null, o.status, o.refNumber ?? null, o.raisedAt, o.clearedAt ?? null,
          o.clearedAt ? 'Answered' : null, o.raisedByName ?? 'Sam Rivera', o.status === 'missed' ? o.neededBy : null, o.variance ?? null],
      );
    await addCon({ description: 'Piping flush complete for CRAH-2-08', category: 'predecessor_work', activityId: crahPfc.id, taskId: crahTasks[7], owner: u['Dana Ortiz'], neededBy: w(-4), status: 'missed', raisedAt: w(-12), variance: 'predecessor', raisedByName: 'Marcus Cole' });
    await addCon({ description: 'Permanent power not yet at CRAH panels 5–8', category: 'predecessor_work', activityId: crahStartup.id, taskId: crahStartTask.id, neededBy: d(2), status: 'raised', raisedAt: d(-1) + 'T13:20:00Z', raisedByName: 'Dana Ortiz' });
    const relay = await act('Breaker settings and relay testing%');
    await addCon({ description: 'RFI-041 Breaker trip settings for feeder F-12', category: 'rfi', activityId: relay.id, owner: u['Priya Shah'], neededBy: d(-3), status: 'cleared', refNumber: 'RFI-041', raisedAt: d(-16), clearedAt: d(-10) + 'T16:00:00Z' });
    const upsSet = await act('Set, terminate & torque UPS%');
    await addCon({ description: 'RFI-044 UPS battery cabinet anchoring detail', category: 'rfi', activityId: upsSet.id, owner: u['Priya Shah'], neededBy: d(0), status: 'cleared', refNumber: 'RFI-044', raisedAt: d(-9), clearedAt: d(-6) + 'T16:00:00Z' });
    const fa = await act('Install and terminate fire alarm devices%');
    await addCon({ description: 'RFI-047 Smoke detector spacing under raised floor', category: 'rfi', activityId: fa.id, owner: u['Priya Shah'], neededBy: d(5), status: 'open', refNumber: 'RFI-047', raisedAt: d(-3) });

    // Activity actuals for work already under way; a couple of plan rows left stale (FR-13).
    await c.query(`update activities set actual_start = planned_start where project_id = $1 and planned_start < $2 and actual_start is null and name not like '%(wk %'`, [pid, today]);
    await c.query(`update activities set actual_finish = planned_finish where project_id = $1 and planned_finish < $2 and actual_finish is null and id <> $3 and name not like '%(wk %'`, [pid, d(-1), crahPfc.id]);
    await c.query(`update activities set updated_at = now() - interval '1 day' where project_id = $1`, [pid]);
    await c.query(`update activities set updated_at = now() - interval '9 days' where project_id = $1 and name ilike any(array['Install and terminate fire alarm devices%', 'Panel programming%'])`, [pid]);

    // Milestone confidence (§10 milestone forecast vs target).
    await c.query(`update milestones set confidence = 'low', forecast_date = target_date + 3 where project_id = $1 and name ilike 'Energize · UPS Plant B'`, [pid]);
    await c.query(`update milestones set confidence = 'high' where project_id = $1 and name ilike '%Switchgear%'`, [pid]);
    await c.query(`update milestones set authoriser_user_id = $2 where project_id = $1 and kind = 'energization'`, [pid, u['Alex Kim']]);
    await c.query(`insert into milestones (project_id, name, kind, cx_level, target_date, forecast_date, confidence) values ($1, 'Integrated Systems Test (L5) — Data Hall 2', 'cx_level', 5, $2, $3, 'medium')`, [pid, d(56), d(59)]);

    return { pid, users: u };
  });

  // This week's plan: commit READY tasks starting this week (Electrical confirmed by Marcus via link, others pending).
  const b = await loadBundle(result.pid, 'super');
  for (const t of b.tasks.filter((t) => t.plannedStart <= addDays(T, 6) && t.plannedFinish >= T && !t.name.includes('CRAH-2-0') && !b.activities.find((a) => a.id === t.activityId)?.actualFinish && b.taskReadiness[t.id]?.state === 'ready')) {
    const elec = b.trades.find((x) => x.name === 'Electrical')!.id;
    await pool.query(
      `insert into commitments (project_id, week_start, task_id, trade_id, crew_size, promised_start, promised_finish, status, confirmed_at, confirmed_by_name)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict do nothing`,
      [result.pid, T, t.id, t.tradeId, t.crewSize, t.plannedStart, t.plannedFinish, t.tradeId === elec ? 'confirmed' : 'proposed', t.tradeId === elec ? new Date() : null, t.tradeId === elec ? 'Marcus Cole' : null],
    );
  }
  await runEscalations({ projectId: result.pid });
  const counts = await q(pool, `select (select count(*) from activities)::int as activities, (select count(*) from constraints)::int as constraints, (select count(*) from commitments)::int as commitments, (select count(*) from notifications)::int as notifications`);
  if (!quiet) console.log('Seeded sample project', result.pid, counts[0]);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seed()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
