// FR-05 escalation + §8 auto-miss (decision A-3, A-7).
//  owner   at 7 and 2 days before needed-by (if still not cleared)
//  super   on the needed-by date
//  PM(s)   at 2 days overdue
// Each level fires once per constraint (escalations table). Safe to run repeatedly.
import { diffDays, ESCALATION, hourIn, todayIn, type Constraint } from '@lookahead/shared';
import { pool, q } from '../db';
import { audit } from '../audit';
import { notify } from '../notify';

type Level = 'owner_7d' | 'owner_2d' | 'super_due' | 'pm_overdue_2d';

function levelsFor(daysLeft: number): Level[] {
  const out: Level[] = [];
  if (daysLeft > ESCALATION.ownerSecond && daysLeft <= ESCALATION.ownerFirst) out.push('owner_7d');
  if (daysLeft > 0 && daysLeft <= ESCALATION.ownerSecond) out.push('owner_2d');
  if (daysLeft <= 0) out.push('super_due');
  if (daysLeft <= -ESCALATION.pmOverdue) out.push('pm_overdue_2d');
  return out;
}

export async function runEscalations(opts: { projectId?: string; now?: Date; respectHour?: boolean } = {}) {
  const now = opts.now ?? new Date();
  const projects = await q<{ id: string; name: string; timezone: string }>(
    pool,
    'select id, name, timezone from projects where ($1::uuid is null or id = $1)',
    [opts.projectId ?? null],
  );
  const summary = { projects: 0, missed: 0, notifications: 0 };
  const hour = Number(process.env.ESCALATION_HOUR ?? 6);

  for (const p of projects) {
    if (opts.respectHour && hourIn(p.timezone, now) < hour) continue;
    summary.projects++;
    const today = todayIn(p.timezone, now);
    const members = await q<{ userId: string; role: string }>(pool, 'select user_id, role from project_members where project_id = $1', [p.id]);
    const supers = members.filter((m) => m.role === 'super').map((m) => m.userId);
    const pms = members.filter((m) => m.role === 'pm').map((m) => m.userId);

    // Auto-miss: still open the day after needed-by.
    const missed = await q<Constraint>(
      pool,
      `update constraints set status = 'missed', missed_at = now(), updated_at = now()
       where project_id = $1 and status in ('open','promised') and needed_by < $2 returning *`,
      [p.id, today],
    );
    for (const c of missed) {
      summary.missed++;
      await audit(pool, { projectId: p.id, entityType: 'constraint', entityId: c.id, action: 'status_missed', changes: { status: { from: 'open', to: 'missed' }, auto: true }, actor: { name: 'Lookahead (automatic)' } });
      if (c.ownerUserId)
        await notify(pool, {
          projectId: p.id, userIds: [c.ownerUserId], kind: 'constraint_missed', entityType: 'constraint', entityId: c.id,
          title: `#${c.number} missed its needed-by date (${c.neededBy})`,
          body: `"${c.description}" was needed by ${c.neededBy} and is not cleared. Log the reason and a new promised date, or clear it.`,
          link: `/p/${p.id}/constraints?c=${c.id}`,
        });
    }

    const active = await q<Constraint>(
      pool,
      `select * from constraints where project_id = $1 and status in ('raised','open','promised','missed') and needed_by is not null`,
      [p.id],
    );
    for (const c of active) {
      const left = diffDays(today, c.neededBy!);
      for (const level of levelsFor(left)) {
        const recipients = level.startsWith('owner') ? (c.ownerUserId ? [c.ownerUserId] : []) : level === 'super_due' ? supers : pms;
        if (!recipients.length) continue;
        const ins = await pool.query('insert into escalations (constraint_id, level) values ($1, $2) on conflict do nothing returning 1', [c.id, level]);
        if (!ins.rowCount) continue;
        const when = left > 0 ? `due in ${left} day${left === 1 ? '' : 's'} (${c.neededBy})` : left === 0 ? 'due today' : `${-left} days overdue`;
        await notify(pool, {
          projectId: p.id, userIds: recipients, kind: `escalation_${level}`, entityType: 'constraint', entityId: c.id,
          title: `${level === 'pm_overdue_2d' ? 'Overdue: ' : ''}#${c.number} ${c.description} — ${when}`,
          body: `Constraint #${c.number} "${c.description}" on ${p.name} is ${when} and not cleared.${c.ownerUserId ? '' : ' It has no owner yet.'}`,
          link: `/p/${p.id}/constraints?c=${c.id}`,
        });
        summary.notifications += recipients.length;
      }
    }
  }
  return summary;
}

export function startEscalationScheduler() {
  if (process.env.ESCALATIONS_ENABLED === 'false') return;
  const tick = () => runEscalations({ respectHour: true }).catch((e) => console.error('[escalations]', e));
  setTimeout(tick, 10_000);
  setInterval(tick, 60 * 60 * 1000);
}
