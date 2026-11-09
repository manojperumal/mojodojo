// Rule-based readiness (PRD §6, §9, FR-07). Never AI, always explainable:
// every non-READY state carries the reasons that produced it.

import { ACTIVE_STATUSES, CATEGORY_LABELS, type Readiness } from './constants';
import { diffDays, type ISODate } from './dates';
import type {
  Activity,
  Constraint,
  Equipment,
  GateStatus,
  Milestone,
  ReadinessReason,
  ReadinessResult,
  Task,
} from './types';

const RANK: Record<Readiness, number> = { ready: 0, constrained: 1, at_risk: 2 };

export function worst(a: Readiness, b: Readiness): Readiness {
  return RANK[a] >= RANK[b] ? a : b;
}

export function isActive(c: Pick<Constraint, 'status'>): boolean {
  return ACTIVE_STATUSES.includes(c.status);
}

function label(c: Constraint): string {
  return `#${c.number} ${c.description}`;
}

/**
 * Risk contributed by one constraint to work starting on `workStart`.
 * Returns null when the constraint no longer blocks anything.
 */
export function constraintRisk(
  c: Constraint,
  today: ISODate,
  workStart?: ISODate | null,
): ReadinessReason | null {
  if (c.status === 'cleared') return null;
  const base = { constraintId: c.id };
  if (c.status === 'missed') return { ...base, severity: 'at_risk', text: `${label(c)} — missed its needed-by date` };
  if (!c.ownerUserId) return { ...base, severity: 'at_risk', text: `${label(c)} — no owner` };
  if (!c.neededBy) return { ...base, severity: 'at_risk', text: `${label(c)} — no needed-by date` };
  if (c.neededBy < today)
    return { ...base, severity: 'at_risk', text: `${label(c)} — ${diffDays(c.neededBy, today)}d past needed-by` };
  if (c.promisedDate && c.promisedDate > c.neededBy)
    return {
      ...base,
      severity: 'at_risk',
      text: `${label(c)} — promised ${diffDays(c.neededBy, c.promisedDate)}d after needed-by`,
    };
  if (workStart && c.neededBy > workStart)
    return { ...base, severity: 'at_risk', text: `${label(c)} — needed-by is after the work starts` };
  return {
    ...base,
    severity: 'constrained',
    text: `${label(c)} — ${CATEGORY_LABELS[c.category]}, ${c.status === 'promised' ? 'promised' : 'open'}`,
  };
}

export function equipmentRisk(e: Equipment, workStart: ISODate | null): ReadinessReason | null {
  if (e.actualDelivery) return null;
  const base = { equipmentId: e.id };
  if (e.promisedDelivery && e.requiredOnSite && e.promisedDelivery > e.requiredOnSite)
    return {
      ...base,
      severity: 'at_risk',
      text: `${e.tag} promised ${diffDays(e.requiredOnSite, e.promisedDelivery)}d after required-on-site`,
    };
  if (workStart && e.promisedDelivery && e.promisedDelivery > workStart)
    return { ...base, severity: 'at_risk', text: `${e.tag} arrives after the work starts` };
  if (!e.promisedDelivery) return { ...base, severity: 'constrained', text: `${e.tag} not delivered — no promised date` };
  return { ...base, severity: 'constrained', text: `${e.tag} not yet delivered (promised ${e.promisedDelivery})` };
}

export function computeGates(
  milestones: Milestone[],
  constraints: Constraint[],
  today: ISODate,
): Record<string, GateStatus> {
  const out: Record<string, GateStatus> = {};
  for (const m of milestones) {
    if (m.kind !== 'energization') continue;
    const open = constraints.filter((c) => c.milestoneId === m.id && c.status !== 'cleared');
    const atRisk = open.some((c) => constraintRisk(c, today, m.targetDate)?.severity === 'at_risk');
    out[m.id] = {
      milestoneId: m.id,
      openConstraintIds: open.map((c) => c.id),
      atRisk,
      confirmed: !!m.gateConfirmedAt,
      cleared: open.length === 0 && !!m.gateConfirmedAt,
    };
  }
  return out;
}

function summarize(reasons: ReadinessReason[], override: Readiness | null): ReadinessResult {
  let computed: Readiness = 'ready';
  for (const r of reasons) computed = worst(computed, r.severity);
  const order = [...reasons].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
  const top = order.find((r) => r.constraintId)?.constraintId ?? null;
  return {
    state: override ?? computed,
    computed,
    overridden: !!override && override !== computed,
    reasons: order,
    topConstraintId: top,
  };
}

export interface ReadinessInput {
  activities: Activity[];
  tasks: Task[];
  constraints: Constraint[];
  equipment: Equipment[];
  milestones: Milestone[];
  today: ISODate;
}

export interface ReadinessOutput {
  readiness: Record<string, ReadinessResult>;
  taskReadiness: Record<string, ReadinessResult>;
  gates: Record<string, GateStatus>;
}

export function computeReadiness(input: ReadinessInput): ReadinessOutput {
  const { activities, tasks, constraints, equipment, milestones, today } = input;
  const actById = new Map(activities.map((a) => [a.id, a]));
  const eqById = new Map(equipment.map((e) => [e.id, e]));
  const byActivity = new Map<string, Constraint[]>();
  for (const c of constraints) {
    if (!c.activityId) continue;
    const list = byActivity.get(c.activityId) ?? [];
    list.push(c);
    byActivity.set(c.activityId, list);
  }
  const gates = computeGates(milestones, constraints, today);
  const energizationFor = new Map<string, Milestone[]>();
  for (const m of milestones) {
    if (m.kind !== 'energization') continue;
    for (const aid of m.activityIds) energizationFor.set(aid, [...(energizationFor.get(aid) ?? []), m]);
  }

  // Reasons that apply to the whole activity (not specific to one task).
  const sharedReasons = (a: Activity): ReadinessReason[] => {
    const rs: ReadinessReason[] = [];
    for (const pid of a.predecessorIds) {
      const p = actById.get(pid);
      if (!p || p.actualFinish) continue;
      if (p.plannedFinish >= a.plannedStart)
        rs.push({ severity: 'at_risk', activityId: p.id, text: `Predecessor "${p.name}" finishes ${p.plannedFinish}, on or after this start` });
    }
    for (const eid of a.equipmentIds) {
      const e = eqById.get(eid);
      const r = e && equipmentRisk(e, a.plannedStart);
      if (r) rs.push(r);
    }
    if ((a.cxLevel ?? 0) >= 3) {
      for (const m of energizationFor.get(a.id) ?? []) {
        const g = gates[m.id];
        if (g && !g.cleared)
          rs.push({
            severity: g.atRisk ? 'at_risk' : 'constrained',
            milestoneId: m.id,
            text: `Energization gate "${m.name}" not cleared (${g.openConstraintIds.length} open${g.confirmed ? '' : ', not authorised'})`,
          });
      }
    }
    return rs;
  };

  const readiness: Record<string, ReadinessResult> = {};
  const taskReadiness: Record<string, ReadinessResult> = {};
  const sharedCache = new Map<string, ReadinessReason[]>();

  for (const a of activities) {
    if (a.actualFinish) {
      readiness[a.id] = { state: 'ready', computed: 'ready', overridden: false, reasons: [], topConstraintId: null };
      continue;
    }
    const shared = sharedReasons(a);
    sharedCache.set(a.id, shared);
    const rs = [...shared];
    for (const c of byActivity.get(a.id) ?? []) {
      const r = constraintRisk(c, today, a.plannedStart);
      if (r) rs.push(r);
    }
    readiness[a.id] = summarize(rs, a.readinessOverride);
  }

  for (const t of tasks) {
    const a = actById.get(t.activityId);
    if (!a) continue;
    if (a.actualFinish) {
      taskReadiness[t.id] = readiness[a.id];
      continue;
    }
    const rs = [...(sharedCache.get(a.id) ?? [])];
    for (const c of byActivity.get(a.id) ?? []) {
      if (c.taskId && c.taskId !== t.id) continue;
      const r = constraintRisk(c, today, t.plannedStart);
      if (r) rs.push(r);
    }
    // A super override on the activity applies to its tasks too (logged on the activity).
    taskReadiness[t.id] = summarize(rs, a.readinessOverride);
  }

  return { readiness, taskReadiness, gates };
}
