// Pre-commissioning starter checklists (PRD §9, FR-15).
// Each template generates the standard L2–L3 activities and constraints for one system,
// so a super starts from ~80% complete instead of a blank board.
// Offsets are calendar days from the anchor date (the system's L2 start).

import type { ConstraintCategory, Role, SystemType } from './constants';

export interface TemplateConstraint {
  category: ConstraintCategory;
  description: string;
  /** Days relative to the activity's planned start (negative = before). */
  neededByOffset: number;
  ownerRole: Role;
}

export interface TemplateActivity {
  key: string;
  name: string;
  level: 2 | 3;
  start: number;
  duration: number;
  trade: string;
  crew: number;
  predecessors?: string[];
  tasks?: string[];
  constraints: TemplateConstraint[];
}

export interface TemplateMilestone {
  name: string;
  kind: 'energization' | 'cx_level';
  cxLevel?: number;
  /** Target = anchor + offset */
  offset: number;
  activityKeys: string[];
  gate?: TemplateConstraint[]; // energization mini-gate; offsets relative to the milestone target
}

export interface SystemTemplate {
  key: string;
  systemType: SystemType;
  label: string;
  activities: TemplateActivity[];
  milestones: TemplateMilestone[];
}

const energizationGate: TemplateConstraint[] = [
  { category: 'permit_inspection', description: 'AHJ electrical inspection passed', neededByOffset: -5, ownerRole: 'field_engineer' },
  { category: 'decision', description: 'Utility / owner approval to energize', neededByOffset: -5, ownerRole: 'pm' },
  { category: 'documentation', description: 'Arc-flash labels installed per study', neededByOffset: -2, ownerRole: 'field_engineer' },
  { category: 'safety_energization', description: 'Energization permit signed and LOTO plan issued', neededByOffset: -2, ownerRole: 'super' },
];

export const TEMPLATES: SystemTemplate[] = [
  {
    key: 'ups',
    systemType: 'ups',
    label: 'UPS plant',
    activities: [
      {
        key: 'set', name: 'Set, terminate & torque UPS modules and battery cabinets', level: 2, start: 0, duration: 5, trade: 'Electrical', crew: 6,
        tasks: ['Set UPS modules', 'Set battery cabinets', 'Terminate & torque feeders'],
        constraints: [
          { category: 'material_equipment', description: 'UPS modules and battery cabinets on site', neededByOffset: -14, ownerRole: 'pm' },
          { category: 'design_drawing', description: 'IFC one-line and termination drawings in the field', neededByOffset: -7, ownerRole: 'field_engineer' },
        ],
      },
      {
        key: 'pfc', name: 'Pre-functional checklists (L2) — UPS', level: 2, start: 5, duration: 3, trade: 'Electrical', crew: 2, predecessors: ['set'],
        constraints: [{ category: 'documentation', description: 'L2 pre-functional checklists issued by CxA', neededByOffset: -10, ownerRole: 'field_engineer' }],
      },
      {
        key: 'energize', name: 'Energize UPS input', level: 3, start: 10, duration: 1, trade: 'Electrical', crew: 4, predecessors: ['pfc'],
        constraints: [],
      },
      {
        key: 'startup', name: 'Vendor start-up — UPS modules', level: 3, start: 11, duration: 3, trade: 'UPS Vendor', crew: 2, predecessors: ['energize'],
        constraints: [
          { category: 'vendor_startup', description: 'UPS vendor start-up technician booked', neededByOffset: -14, ownerRole: 'pm' },
          { category: 'submittal', description: 'UPS start-up procedure approved', neededByOffset: -10, ownerRole: 'pm' },
        ],
      },
      {
        key: 'functional', name: 'Functional checks (L3) — transfer and battery discharge', level: 3, start: 14, duration: 2, trade: 'UPS Vendor', crew: 2, predecessors: ['startup'],
        constraints: [
          { category: 'documentation', description: 'L3 functional test scripts approved by CxA', neededByOffset: -7, ownerRole: 'field_engineer' },
          { category: 'material_equipment', description: 'Load bank on site for discharge test', neededByOffset: -3, ownerRole: 'field_engineer' },
        ],
      },
    ],
    milestones: [
      { name: 'Energize', kind: 'energization', offset: 10, activityKeys: ['energize', 'startup', 'functional'], gate: energizationGate },
      { name: 'L3 complete — ready for L4', kind: 'cx_level', cxLevel: 4, offset: 16, activityKeys: ['functional'] },
    ],
  },
  {
    key: 'switchgear',
    systemType: 'switchgear',
    label: 'Switchgear lineup',
    activities: [
      {
        key: 'set', name: 'Set switchgear sections and splice bus', level: 2, start: 0, duration: 4, trade: 'Electrical', crew: 6,
        constraints: [
          { category: 'material_equipment', description: 'Switchgear sections delivered', neededByOffset: -10, ownerRole: 'pm' },
          { category: 'access_space', description: 'Electrical room turned over (dry, lockable)', neededByOffset: -3, ownerRole: 'super' },
        ],
      },
      {
        key: 'megger', name: 'Torque, megger and terminate feeders', level: 2, start: 4, duration: 4, trade: 'Electrical', crew: 4, predecessors: ['set'],
        constraints: [{ category: 'documentation', description: 'Torque and megger test forms issued', neededByOffset: -5, ownerRole: 'field_engineer' }],
      },
      {
        key: 'pfc', name: 'Pre-functional checklists (L2) — switchgear', level: 2, start: 8, duration: 2, trade: 'Electrical', crew: 2, predecessors: ['megger'],
        constraints: [{ category: 'documentation', description: 'L2 pre-functional checklists issued by CxA', neededByOffset: -10, ownerRole: 'field_engineer' }],
      },
      {
        key: 'relay', name: 'Breaker settings and relay testing (NETA)', level: 3, start: 10, duration: 3, trade: 'Testing Agency', crew: 2, predecessors: ['pfc'],
        constraints: [
          { category: 'submittal', description: 'Coordination study and breaker settings approved', neededByOffset: -14, ownerRole: 'pm' },
          { category: 'vendor_startup', description: 'Testing agency booked', neededByOffset: -14, ownerRole: 'pm' },
        ],
      },
      {
        key: 'energize', name: 'Energize switchgear lineup', level: 3, start: 13, duration: 1, trade: 'Electrical', crew: 4, predecessors: ['relay'],
        constraints: [],
      },
      {
        key: 'functional', name: 'Functional checks (L3) — transfer schemes and interlocks', level: 3, start: 14, duration: 2, trade: 'Electrical', crew: 2, predecessors: ['energize'],
        constraints: [{ category: 'documentation', description: 'L3 functional test scripts approved by CxA', neededByOffset: -7, ownerRole: 'field_engineer' }],
      },
    ],
    milestones: [
      { name: 'Energize', kind: 'energization', offset: 13, activityKeys: ['energize', 'functional'], gate: energizationGate },
      { name: 'L3 complete — ready for L4', kind: 'cx_level', cxLevel: 4, offset: 16, activityKeys: ['functional'] },
    ],
  },
  {
    key: 'generator',
    systemType: 'generator',
    label: 'Generator plant',
    activities: [
      {
        key: 'set', name: 'Set generators, connect fuel and exhaust', level: 2, start: 0, duration: 5, trade: 'Electrical', crew: 6,
        constraints: [
          { category: 'material_equipment', description: 'Generators and day tanks on site', neededByOffset: -14, ownerRole: 'pm' },
          { category: 'predecessor_work', description: 'Fuel piping pressure test complete', neededByOffset: -2, ownerRole: 'field_engineer' },
        ],
      },
      {
        key: 'pfc', name: 'Pre-functional checklists (L2) — generators', level: 2, start: 5, duration: 2, trade: 'Electrical', crew: 2, predecessors: ['set'],
        constraints: [{ category: 'documentation', description: 'L2 pre-functional checklists issued by CxA', neededByOffset: -10, ownerRole: 'field_engineer' }],
      },
      {
        key: 'fuel', name: 'Initial fuel fill', level: 3, start: 7, duration: 1, trade: 'Mechanical', crew: 2, predecessors: ['pfc'],
        constraints: [{ category: 'material_equipment', description: 'Diesel fuel delivery scheduled', neededByOffset: -7, ownerRole: 'field_engineer' }],
      },
      {
        key: 'startup', name: 'Vendor start-up — generators', level: 3, start: 8, duration: 3, trade: 'Generator Vendor', crew: 2, predecessors: ['fuel'],
        constraints: [
          { category: 'vendor_startup', description: 'Generator vendor start-up technician booked', neededByOffset: -14, ownerRole: 'pm' },
          { category: 'permit_inspection', description: 'Air permit to operate in place', neededByOffset: -7, ownerRole: 'pm' },
        ],
      },
      {
        key: 'loadbank', name: 'Load-bank test (L3)', level: 3, start: 11, duration: 2, trade: 'Generator Vendor', crew: 3, predecessors: ['startup'],
        constraints: [
          { category: 'material_equipment', description: 'Load-bank rental confirmed', neededByOffset: -21, ownerRole: 'field_engineer' },
          { category: 'submittal', description: 'Approved generator test procedure', neededByOffset: -14, ownerRole: 'pm' },
        ],
      },
    ],
    milestones: [{ name: 'L3 complete — ready for L4', kind: 'cx_level', cxLevel: 4, offset: 13, activityKeys: ['loadbank'] }],
  },
  {
    key: 'crah_chw',
    systemType: 'crah_chw',
    label: 'CRAH / chilled-water loop',
    activities: [
      {
        key: 'flush', name: 'Chilled-water piping flush and pressure test', level: 2, start: 0, duration: 4, trade: 'Mechanical', crew: 4,
        constraints: [
          { category: 'submittal', description: 'Flushing and water treatment plan approved', neededByOffset: -10, ownerRole: 'pm' },
          { category: 'material_equipment', description: 'Temporary flush pump and strainers on site', neededByOffset: -3, ownerRole: 'field_engineer' },
        ],
      },
      {
        key: 'set', name: 'Set and connect CRAH units', level: 2, start: 2, duration: 4, trade: 'Mechanical', crew: 6,
        tasks: ['Set CRAH units', 'Connect CHW piping', 'Connect condensate'],
        constraints: [{ category: 'material_equipment', description: 'CRAH units delivered', neededByOffset: -10, ownerRole: 'pm' }],
      },
      {
        key: 'p2p', name: 'Controls point-to-point checkout', level: 2, start: 6, duration: 3, trade: 'Controls', crew: 2, predecessors: ['set'],
        constraints: [{ category: 'submittal', description: 'BMS points list and sequences approved', neededByOffset: -14, ownerRole: 'pm' }],
      },
      {
        key: 'pfc', name: 'Pre-functional checklists (L2) — CRAH units', level: 2, start: 6, duration: 3, trade: 'Mechanical', crew: 2, predecessors: ['set', 'flush'],
        constraints: [{ category: 'documentation', description: 'L2 pre-functional checklists issued by CxA', neededByOffset: -10, ownerRole: 'field_engineer' }],
      },
      {
        key: 'startup', name: 'Start-up and rotation checks (L3) — CRAH units', level: 3, start: 9, duration: 3, trade: 'Mechanical', crew: 3, predecessors: ['pfc', 'p2p'],
        constraints: [
          { category: 'predecessor_work', description: 'Permanent power available to CRAH panels', neededByOffset: -3, ownerRole: 'super' },
          { category: 'vendor_startup', description: 'CRAH manufacturer start-up booked', neededByOffset: -14, ownerRole: 'pm' },
        ],
      },
      {
        key: 'tab', name: 'Test, adjust and balance', level: 3, start: 12, duration: 3, trade: 'TAB', crew: 2, predecessors: ['startup'],
        constraints: [{ category: 'vendor_startup', description: 'TAB contractor scheduled', neededByOffset: -10, ownerRole: 'pm' }],
      },
    ],
    milestones: [{ name: 'L3 complete — ready for L4', kind: 'cx_level', cxLevel: 4, offset: 15, activityKeys: ['tab'] }],
  },
  {
    key: 'fire_alarm',
    systemType: 'fire_alarm',
    label: 'Fire alarm',
    activities: [
      {
        key: 'devices', name: 'Install and terminate fire alarm devices', level: 2, start: 0, duration: 5, trade: 'Fire Alarm', crew: 3,
        constraints: [{ category: 'submittal', description: 'Fire alarm shop drawings approved by AHJ', neededByOffset: -21, ownerRole: 'pm' }],
      },
      {
        key: 'program', name: 'Panel programming and device addressing', level: 2, start: 5, duration: 3, trade: 'Fire Alarm', crew: 2, predecessors: ['devices'],
        constraints: [{ category: 'decision', description: 'Sequence of operations / cause-and-effect matrix signed off', neededByOffset: -7, ownerRole: 'pm' }],
      },
      {
        key: 'pretest', name: 'Fire alarm pre-test (100% devices)', level: 3, start: 8, duration: 2, trade: 'Fire Alarm', crew: 2, predecessors: ['program'],
        constraints: [{ category: 'documentation', description: 'Pre-test device report format agreed with CxA', neededByOffset: -5, ownerRole: 'field_engineer' }],
      },
      {
        key: 'acceptance', name: 'AHJ fire alarm acceptance test', level: 3, start: 12, duration: 1, trade: 'Fire Alarm', crew: 2, predecessors: ['pretest'],
        constraints: [{ category: 'permit_inspection', description: 'AHJ acceptance test requested', neededByOffset: -10, ownerRole: 'field_engineer' }],
      },
    ],
    milestones: [{ name: 'AHJ acceptance — ready for L4', kind: 'cx_level', cxLevel: 4, offset: 13, activityKeys: ['acceptance'] }],
  },
];

export function getTemplate(key: string): SystemTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}
