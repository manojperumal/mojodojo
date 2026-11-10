// PRD §10 metrics: PPC, delay reduction, constraint clearance, RFI cycle time.

import { VARIANCE_REASONS, type VarianceReason } from './constants';
import { addDays, diffDays, median, weekStart, type ISODate } from './dates';
import type { Activity, Commitment, Constraint, Milestone, Task } from './types';

export interface PPCWeek {
  weekStart: ISODate;
  committed: number; // confirmed + done + not_done
  done: number;
  notDone: number;
  pending: number; // confirmed but not yet marked
  ppc: number | null; // done / (done + notDone), null until something is marked
}

export interface PPCGroup {
  key: string;
  committed: number;
  done: number;
  notDone: number;
  ppc: number | null;
}

const COUNTED = new Set(['confirmed', 'done', 'not_done']);

function rate(done: number, notDone: number): number | null {
  return done + notDone === 0 ? null : done / (done + notDone);
}

export function ppcByWeek(commitments: Commitment[], weeks: ISODate[]): PPCWeek[] {
  return weeks.map((w) => {
    const cs = commitments.filter((c) => c.weekStart === w && COUNTED.has(c.status));
    const done = cs.filter((c) => c.status === 'done').length;
    const notDone = cs.filter((c) => c.status === 'not_done').length;
    return { weekStart: w, committed: cs.length, done, notDone, pending: cs.length - done - notDone, ppc: rate(done, notDone) };
  });
}

export function ppcGrouped(
  commitments: Commitment[],
  keyOf: (c: Commitment) => string | null | undefined,
): PPCGroup[] {
  const groups = new Map<string, PPCGroup>();
  for (const c of commitments) {
    if (!COUNTED.has(c.status)) continue;
    const key = keyOf(c) ?? 'Unassigned';
    const g = groups.get(key) ?? { key, committed: 0, done: 0, notDone: 0, ppc: null };
    g.committed++;
    if (c.status === 'done') g.done++;
    if (c.status === 'not_done') g.notDone++;
    groups.set(key, g);
  }
  for (const g of groups.values()) g.ppc = rate(g.done, g.notDone);
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function varianceBreakdown(commitments: Commitment[]): { reason: VarianceReason; count: number }[] {
  const counts = new Map<VarianceReason, number>();
  for (const c of commitments) if (c.status === 'not_done' && c.varianceReason) counts.set(c.varianceReason, (counts.get(c.varianceReason) ?? 0) + 1);
  return VARIANCE_REASONS.map((reason) => ({ reason, count: counts.get(reason) ?? 0 })).filter((x) => x.count > 0);
}

export interface ClearanceMetrics {
  total: number;
  active: number;
  orphaned: number; // active with no owner or no needed-by (target: zero)
  clearedOnTime: number;
  clearedLate: number;
  missedOrOverdue: number;
  onTimeRate: number | null; // cleared by needed-by / constraints that came due
  clearedEarly: number; // cleared at least one day before needed-by
  clearedEarlyRate: number | null;
  medianDaysToClear: number | null;
  avgDaysInState: Record<string, number | null>;
}

const day = (ts: string | null) => (ts ? ts.slice(0, 10) : null);

export function constraintClearance(constraints: Constraint[], today: ISODate): ClearanceMetrics {
  const active = constraints.filter((c) => ['raised', 'open', 'promised'].includes(c.status));
  const cleared = constraints.filter((c) => c.status === 'cleared' && c.clearedAt);
  const onTime = cleared.filter((c) => !c.neededBy || day(c.clearedAt)! <= c.neededBy);
  const early = cleared.filter((c) => c.neededBy && day(c.clearedAt)! < c.neededBy);
  const missedOrOverdue =
    constraints.filter((c) => c.status === 'missed').length +
    active.filter((c) => c.neededBy && c.neededBy < today).length;
  const cameDue = cleared.length + missedOrOverdue;
  const toClear = cleared.map((c) => diffDays(day(c.raisedAt)!, day(c.clearedAt)!));
  return {
    total: constraints.length,
    active: active.length,
    orphaned: active.filter((c) => !c.ownerUserId || !c.neededBy).length,
    clearedOnTime: onTime.length,
    clearedLate: cleared.length - onTime.length,
    missedOrOverdue,
    onTimeRate: cameDue ? onTime.length / cameDue : null,
    clearedEarly: early.length,
    clearedEarlyRate: cleared.length ? early.length / cleared.length : null,
    medianDaysToClear: median(toClear),
    avgDaysInState: {
      raisedToCleared: toClear.length ? toClear.reduce((a, b) => a + b, 0) / toClear.length : null,
    },
  };
}

export interface RfiMetrics {
  open: number;
  cleared: number;
  medianCycleDays: number | null;
  answeredBeforeWork: number; // cleared before the linked activity's planned start
  answeredBeforeWorkRate: number | null;
}

export function rfiCycle(constraints: Constraint[], activities: Activity[]): RfiMetrics {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const rfis = constraints.filter((c) => c.category === 'rfi');
  const cleared = rfis.filter((c) => c.status === 'cleared' && c.clearedAt);
  const linked = cleared.filter((c) => c.activityId && byId.has(c.activityId));
  const before = linked.filter((c) => day(c.clearedAt)! < byId.get(c.activityId!)!.plannedStart);
  return {
    open: rfis.filter((c) => ['raised', 'open', 'promised'].includes(c.status)).length,
    cleared: cleared.length,
    medianCycleDays: median(cleared.map((c) => diffDays(day(c.raisedAt)!, day(c.clearedAt)!))),
    answeredBeforeWork: before.length,
    answeredBeforeWorkRate: linked.length ? before.length / linked.length : null,
  };
}

export interface DelayMetrics {
  dueToStart: number;
  startedOnTime: number;
  startedLate: number;
  notStarted: number;
  onTimeRate: number | null;
  byWeek: { weekStart: ISODate; due: number; onTime: number; rate: number | null }[];
}

/** Activities whose planned start fell in the last `weeks` weeks (up to today). */
export function startDelay(activities: Activity[], today: ISODate, weeks = 6): DelayMetrics {
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  const due = activities.filter((a) => a.plannedStart >= from && a.plannedStart <= today);
  const onTime = (a: Activity) => !!a.actualStart && a.actualStart <= a.plannedStart;
  const byWeek = Array.from({ length: weeks }, (_, i) => {
    const w = addDays(from, i * 7);
    const inWeek = due.filter((a) => weekStart(a.plannedStart) === w);
    const ok = inWeek.filter(onTime).length;
    return { weekStart: w, due: inWeek.length, onTime: ok, rate: inWeek.length ? ok / inWeek.length : null };
  });
  const startedOnTime = due.filter(onTime).length;
  const notStarted = due.filter((a) => !a.actualStart).length;
  return {
    dueToStart: due.length,
    startedOnTime,
    startedLate: due.length - startedOnTime - notStarted,
    notStarted,
    onTimeRate: due.length ? startedOnTime / due.length : null,
    byWeek,
  };
}

export function milestoneVariance(ms: Milestone[]) {
  return ms
    .filter((m) => m.targetDate)
    .map((m) => ({
      id: m.id,
      name: m.name,
      targetDate: m.targetDate!,
      forecastDate: m.forecastDate,
      varianceDays: m.forecastDate ? diffDays(m.targetDate!, m.forecastDate) : null,
      confidence: m.confidence,
    }))
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
}

export function taskTradeKey(tasks: Task[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return (c: Commitment) => c.tradeId ?? byId.get(c.taskId)?.tradeId ?? null;
}
