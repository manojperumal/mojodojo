// Fixed lists from PRD v0.1. Changing these changes reporting comparability (PRD §6).

export const CONSTRAINT_CATEGORIES = [
  'rfi',
  'submittal',
  'material_equipment',
  'design_drawing',
  'predecessor_work',
  'labor_crew',
  'permit_inspection',
  'decision',
  'vendor_startup',
  'documentation',
  'access_space',
  'safety_energization',
] as const;
export type ConstraintCategory = (typeof CONSTRAINT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ConstraintCategory, string> = {
  rfi: 'RFI',
  submittal: 'Submittal',
  material_equipment: 'Material / Equipment',
  design_drawing: 'Design / Drawing',
  predecessor_work: 'Predecessor Work',
  labor_crew: 'Labor / Crew',
  permit_inspection: 'Permit / Inspection (AHJ)',
  decision: 'Decision (owner / GC)',
  vendor_startup: 'Vendor / Start-up',
  documentation: 'Documentation / Test Records',
  access_space: 'Access / Space',
  safety_energization: 'Safety / Energization Permit',
};

/** Constraint lifecycle (PRD §8): Raised → Owned (open) → Promised → Cleared | Missed */
export const CONSTRAINT_STATUSES = ['raised', 'open', 'promised', 'cleared', 'missed'] as const;
export type ConstraintStatus = (typeof CONSTRAINT_STATUSES)[number];
export const STATUS_LABELS: Record<ConstraintStatus, string> = {
  raised: 'Raised',
  open: 'Open',
  promised: 'Promised',
  cleared: 'Cleared',
  missed: 'Missed',
};
export const ACTIVE_STATUSES: ConstraintStatus[] = ['raised', 'open', 'promised'];

export const VARIANCE_REASONS = [
  'predecessor',
  'material',
  'labor',
  'design_rfi',
  'inspection',
  'weather',
  'equipment',
  'planning_error',
  'other',
] as const;
export type VarianceReason = (typeof VARIANCE_REASONS)[number];
export const VARIANCE_LABELS: Record<VarianceReason, string> = {
  predecessor: 'Predecessor',
  material: 'Material',
  labor: 'Labor',
  design_rfi: 'Design / RFI',
  inspection: 'Inspection',
  weather: 'Weather',
  equipment: 'Equipment',
  planning_error: 'Planning Error',
  other: 'Other',
};

export const READINESS_STATES = ['ready', 'constrained', 'at_risk'] as const;
export type Readiness = (typeof READINESS_STATES)[number];
export const READINESS_LABELS: Record<Readiness, string> = {
  ready: 'READY',
  constrained: 'CONSTRAINED',
  at_risk: 'AT RISK',
};

export const ROLES = ['super', 'pm', 'field_engineer', 'foreman', 'cxa', 'owner_viewer'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  super: 'Superintendent',
  pm: 'Project Manager',
  field_engineer: 'Field Engineer',
  foreman: 'Trade Foreman',
  cxa: 'Commissioning Authority',
  owner_viewer: "Owner's Rep (viewer)",
};

export const CX_LEVELS = [1, 2, 3, 4, 5] as const;
export const CX_LEVEL_LABELS: Record<number, string> = {
  1: 'L1 · Factory witness testing',
  2: 'L2 · Installation & pre-functional',
  3: 'L3 · Start-up & functional checks',
  4: 'L4 · Functional performance testing',
  5: 'L5 · Integrated Systems Test',
};

export const SYSTEM_TYPES = ['ups', 'switchgear', 'generator', 'crah_chw', 'fire_alarm', 'other'] as const;
export type SystemType = (typeof SYSTEM_TYPES)[number];
export const SYSTEM_TYPE_LABELS: Record<SystemType, string> = {
  ups: 'UPS plant',
  switchgear: 'Switchgear lineup',
  generator: 'Generator plant',
  crah_chw: 'CRAH / chilled-water loop',
  fire_alarm: 'Fire alarm',
  other: 'Other',
};

export const AREA_KINDS = ['building', 'data_hall', 'pod', 'room', 'zone'] as const;
export type AreaKind = (typeof AREA_KINDS)[number];

export const MILESTONE_KINDS = ['milestone', 'energization', 'cx_level'] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

export const WINDOW_WEEKS = [3, 4, 6] as const;

/** FR-05 escalation thresholds, in days relative to needed-by. */
export const ESCALATION = { ownerFirst: 7, ownerSecond: 2, pmOverdue: 2 } as const;

/** FR-13 — activities not touched in this many days are highlighted as stale. */
export const STALE_DAYS = 7;
