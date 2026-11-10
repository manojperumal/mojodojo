// Common import model. Every source (CSV, P6 XER, P6 XML, templates) maps into these shapes,
// then `applyImport` writes them. Phase 2 sources (Procore) plug in the same way.
import { CATEGORY_LABELS, CONSTRAINT_CATEGORIES, type ConstraintCategory } from '@lookahead/shared';

export interface ImpActivity {
  ref: string | null;
  name: string;
  area?: string | null;
  system?: string | null;
  trade?: string | null;
  start: string;
  finish: string;
  actualStart?: string | null;
  actualFinish?: string | null;
  crewSize?: number | null;
  cxLevel?: number | null;
  predecessorRefs?: string[];
}

export interface ImpEquipment {
  tag: string;
  description?: string | null;
  vendor?: string | null;
  system?: string | null;
  area?: string | null;
  requiredOnSite?: string | null;
  promisedDelivery?: string | null;
  actualDelivery?: string | null;
  startupNeeded?: boolean;
  witnessNeeded?: boolean;
  activityRefs?: string[];
}

export interface ImpConstraint {
  description: string;
  category: ConstraintCategory;
  activity?: string | null; // ref or exact name
  ownerEmail?: string | null;
  neededBy?: string | null;
  promisedDate?: string | null;
  status?: 'open' | 'promised' | 'cleared';
  refNumber?: string | null;
}

export interface ImpMilestone {
  name: string;
  targetDate: string;
  ref?: string | null;
}

export interface ImportPlan {
  source: string;
  activities: ImpActivity[];
  equipment: ImpEquipment[];
  constraints: ImpConstraint[];
  milestones: ImpMilestone[];
  warnings: string[];
  errors: { row: number; message: string }[];
}

export const emptyPlan = (source: string): ImportPlan => ({ source, activities: [], equipment: [], constraints: [], milestones: [], warnings: [], errors: [] });

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const year = (y: number) => (y < 100 ? 2000 + y : y);

/** Accepts 2026-11-09, 2026-11-09 08:00, 11/9/2026, 11/9/26, 09-Nov-26, 9 Nov 2026. US order for slashes. */
export function parseDateLoose(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${year(+m[3])}-${pad(+m[1])}-${pad(+m[2])}`;
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{2,4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${year(+m[3])}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`;
  return null;
}

export function validDate(s: string | null): boolean {
  if (!s) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseCategory(v: unknown): ConstraintCategory | null {
  const s = norm(String(v ?? ''));
  if (!s) return null;
  for (const k of CONSTRAINT_CATEGORIES) if (norm(k) === s || norm(CATEGORY_LABELS[k]) === s) return k;
  const hints: [RegExp, ConstraintCategory][] = [
    [/^rfi/, 'rfi'], [/submit/, 'submittal'], [/material|equip|deliver/, 'material_equipment'], [/design|drawing/, 'design_drawing'],
    [/predecess/, 'predecessor_work'], [/labor|labour|crew|manpower/, 'labor_crew'], [/permit|inspect|ahj/, 'permit_inspection'],
    [/decision|owner/, 'decision'], [/vendor|startup/, 'vendor_startup'], [/doc|test|record/, 'documentation'],
    [/access|space/, 'access_space'], [/safety|energ|loto/, 'safety_energization'],
  ];
  for (const [re, k] of hints) if (re.test(s)) return k;
  return null;
}

export function parseBool(v: unknown): boolean {
  return /^(y|yes|true|1|x)$/i.test(String(v ?? '').trim());
}

export function parseIntLoose(v: unknown): number | null {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function splitList(v: unknown): string[] {
  return String(v ?? '')
    .split(/[;,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
