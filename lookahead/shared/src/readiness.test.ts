import { describe, expect, it } from 'vitest';
import { computeReadiness, constraintRisk } from './readiness';
import { constraintClearance, ppcByWeek, rfiCycle } from './metrics';
import { weekStart, addDays } from './dates';
import type { Activity, Commitment, Constraint, Equipment, Milestone } from './types';

const today = '2026-11-09'; // Monday

const act = (o: Partial<Activity> = {}): Activity => ({
  id: 'a1', projectId: 'p', name: 'UPS B start-up', areaId: null, systemId: null, tradeId: null, cxLevel: 3,
  plannedStart: '2026-11-20', plannedFinish: '2026-11-23', actualStart: null, actualFinish: null, crewSize: 2,
  externalRef: null, readinessOverride: null, overrideNote: null, overrideBy: null, overrideAt: null,
  predecessorIds: [], equipmentIds: [], createdAt: '', updatedAt: '', ...o,
});

const con = (o: Partial<Constraint> = {}): Constraint => ({
  id: 'c1', projectId: 'p', number: 1, description: 'Vendor tech booked', category: 'vendor_startup',
  activityId: 'a1', taskId: null, milestoneId: null, equipmentId: null, ownerUserId: 'u1', neededBy: '2026-11-13',
  promisedDate: null, status: 'open', refNumber: null, raisedAt: '2026-11-01T10:00:00Z', raisedByUserId: null,
  raisedByName: null, clearedAt: null, clearedBy: null, clearanceNote: null, missedAt: null, varianceReason: null,
  createdAt: '', updatedAt: '', ...o,
});

const run = (o: { activities?: Activity[]; constraints?: Constraint[]; equipment?: Equipment[]; milestones?: Milestone[] }) =>
  computeReadiness({ activities: o.activities ?? [act()], tasks: [], constraints: o.constraints ?? [], equipment: o.equipment ?? [], milestones: o.milestones ?? [], today });

describe('weeks', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // Sunday
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
  });
});

describe('readiness', () => {
  it('is READY with no constraints', () => {
    expect(run({}).readiness.a1.state).toBe('ready');
  });
  it('is CONSTRAINED with an owned, dated open constraint', () => {
    const r = run({ constraints: [con()] }).readiness.a1;
    expect(r.state).toBe('constrained');
    expect(r.topConstraintId).toBe('c1');
  });
  it('is READY once the constraint is cleared', () => {
    expect(run({ constraints: [con({ status: 'cleared' })] }).readiness.a1.state).toBe('ready');
  });
  it('is AT RISK with no owner or no date (PRD principle 2)', () => {
    expect(run({ constraints: [con({ ownerUserId: null })] }).readiness.a1.state).toBe('at_risk');
    expect(run({ constraints: [con({ neededBy: null })] }).readiness.a1.state).toBe('at_risk');
  });
  it('is AT RISK when promised after needed-by, overdue, or needed after work starts', () => {
    expect(constraintRisk(con({ promisedDate: '2026-11-15' }), today, '2026-11-20')?.severity).toBe('at_risk');
    expect(constraintRisk(con({ neededBy: '2026-11-06' }), today, '2026-11-20')?.severity).toBe('at_risk');
    expect(constraintRisk(con({ neededBy: '2026-11-25' }), today, '2026-11-20')?.severity).toBe('at_risk');
  });
  it('flags equipment slips as AT RISK (FR-07)', () => {
    const eq: Equipment = { id: 'e1', projectId: 'p', tag: 'UPS-B1', description: null, vendor: null, systemId: null, areaId: null,
      requiredOnSite: '2026-11-12', promisedDelivery: '2026-11-18', actualDelivery: null, startupNeeded: true, witnessNeeded: false, notes: null };
    const r = run({ activities: [act({ equipmentIds: ['e1'] })], equipment: [eq] }).readiness.a1;
    expect(r.state).toBe('at_risk');
    expect(r.reasons[0].text).toMatch(/UPS-B1/);
    const delivered = run({ activities: [act({ equipmentIds: ['e1'] })], equipment: [{ ...eq, actualDelivery: '2026-11-08' }] });
    expect(delivered.readiness.a1.state).toBe('ready');
  });
  it('blocks L3 work behind an uncleared energization gate (§9)', () => {
    const m: Milestone = { id: 'm1', projectId: 'p', name: 'Energize UPS B', kind: 'energization', cxLevel: null, systemId: null,
      targetDate: '2026-11-19', forecastDate: null, confidence: null, authoriserUserId: null, gateConfirmedAt: null, gateConfirmedBy: null, activityIds: ['a1'] };
    const gateCon = con({ id: 'g1', activityId: null, milestoneId: 'm1', neededBy: '2026-11-17' });
    const out = run({ milestones: [m], constraints: [gateCon] });
    expect(out.readiness.a1.state).toBe('constrained');
    expect(out.gates.m1.cleared).toBe(false);
    const cleared = run({ milestones: [{ ...m, gateConfirmedAt: '2026-11-18T00:00:00Z' }], constraints: [{ ...gateCon, status: 'cleared' }] });
    expect(cleared.readiness.a1.state).toBe('ready');
    // L2 activities are not gated
    expect(run({ activities: [act({ cxLevel: 2 })], milestones: [m], constraints: [gateCon] }).readiness.a1.state).toBe('ready');
  });
  it('flags a predecessor that finishes after this start', () => {
    const pred = act({ id: 'a0', name: 'Piping flush', plannedStart: '2026-11-16', plannedFinish: '2026-11-20', predecessorIds: [] });
    expect(run({ activities: [pred, act({ predecessorIds: ['a0'] })] }).readiness.a1.state).toBe('at_risk');
  });
  it('keeps the computed state when overridden', () => {
    const r = run({ activities: [act({ readinessOverride: 'ready' })], constraints: [con({ ownerUserId: null })] }).readiness.a1;
    expect(r.state).toBe('ready');
    expect(r.computed).toBe('at_risk');
    expect(r.overridden).toBe(true);
  });
});

describe('metrics', () => {
  it('computes PPC as done / (done + not done)', () => {
    const c = (status: Commitment['status']): Commitment => ({ id: Math.random() + '', projectId: 'p', weekStart: '2026-11-02', taskId: 't', tradeId: null,
      crewSize: 6, promisedStart: null, promisedFinish: null, status, confirmedAt: null, confirmedByName: null, varianceReason: null, varianceNote: null, overridden: false, createdAt: '' });
    const cs = [...Array(7)].map(() => c('done')).concat([c('not_done'), c('proposed')]);
    const [w] = ppcByWeek(cs, ['2026-11-02']);
    expect(w.committed).toBe(8);
    expect(w.ppc).toBeCloseTo(7 / 8);
  });
  it('computes clearance and RFI cycle time', () => {
    const cs = [
      con({ id: '1', status: 'cleared', clearedAt: '2026-11-05T12:00:00Z', neededBy: '2026-11-08', category: 'rfi' }),
      con({ id: '2', status: 'missed', neededBy: '2026-11-04' }),
      con({ id: '3', status: 'open', ownerUserId: null }),
    ];
    const m = constraintClearance(cs, today);
    expect(m.orphaned).toBe(1);
    expect(m.onTimeRate).toBeCloseTo(0.5);
    expect(m.clearedEarly).toBe(1);
    expect(rfiCycle(cs, [act()]).medianCycleDays).toBe(4);
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});
