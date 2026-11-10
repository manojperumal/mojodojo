// FR-15 CSV / spreadsheet import for activities, equipment and constraints.
import Papa from 'papaparse';
import { emptyPlan, parseBool, parseCategory, parseDateLoose, parseIntLoose, splitList, validDate, type ImportPlan } from './normalize';

export type CsvKind = 'activities' | 'equipment' | 'constraints';

const ALIASES: Record<CsvKind, Record<string, string[]>> = {
  activities: {
    ref: ['id', 'ref', 'activityid', 'activitycode', 'taskcode', 'code'],
    name: ['name', 'activity', 'activityname', 'description', 'taskname'],
    area: ['area', 'zone', 'areazone', 'location', 'datahall', 'pod'],
    system: ['system'],
    trade: ['trade', 'responsibletrade', 'responsible', 'subcontractor', 'contractor'],
    start: ['start', 'plannedstart', 'startdate', 'targetstart', 'earlystart'],
    finish: ['finish', 'plannedfinish', 'finishdate', 'end', 'enddate', 'targetfinish', 'earlyfinish'],
    actualStart: ['actualstart'],
    actualFinish: ['actualfinish'],
    crewSize: ['crew', 'crewsize', 'manpower'],
    cxLevel: ['level', 'cxlevel', 'commissioninglevel'],
    predecessors: ['predecessors', 'predecessor', 'preds'],
  },
  equipment: {
    tag: ['tag', 'equipmenttag', 'equipment', 'id'],
    description: ['description', 'name'],
    vendor: ['vendor', 'manufacturer', 'supplier'],
    system: ['system'],
    area: ['area', 'zone', 'location'],
    requiredOnSite: ['requiredonsite', 'ros', 'required', 'requireddate', 'needonsite'],
    promisedDelivery: ['promiseddelivery', 'promised', 'promiseddate', 'eta', 'forecastdelivery'],
    actualDelivery: ['actualdelivery', 'delivered', 'delivereddate', 'actual'],
    startupNeeded: ['startupneeded', 'startup', 'vendorstartup'],
    witnessNeeded: ['witnessneeded', 'witness', 'fwt'],
    activities: ['activities', 'activity', 'linkedactivities'],
  },
  constraints: {
    description: ['description', 'constraint', 'title', 'name'],
    category: ['category', 'type'],
    activity: ['activity', 'activityid', 'activityref', 'activityname'],
    owner: ['owneremail', 'owner', 'email'],
    neededBy: ['neededby', 'needed', 'needby', 'duedate', 'due'],
    promisedDate: ['promiseddate', 'promised'],
    status: ['status'],
    refNumber: ['refnumber', 'ref', 'number', 'rfi', 'rfinumber', 'submittalnumber'],
  },
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const CSV_TEMPLATES: Record<CsvKind, string> = {
  activities:
    'id,name,area,system,trade,start,finish,crew_size,cx_level,predecessors\n' +
    'A100,Set UPS modules,Electrical Room B,UPS Plant B,Electrical,2026-11-16,2026-11-20,6,2,\n' +
    'A110,Pre-functional checklists — UPS B,Electrical Room B,UPS Plant B,Electrical,2026-11-23,2026-11-25,2,2,A100\n',
  equipment:
    'tag,description,vendor,system,area,required_on_site,promised_delivery,actual_delivery,startup_needed,witness_needed,activities\n' +
    'UPS-B1,UPS module 1 (1.2 MW),Vertex Power,UPS Plant B,Electrical Room B,2026-11-12,2026-11-12,,yes,yes,A100\n',
  constraints:
    'description,category,activity,owner_email,needed_by,promised_date,status,ref_number\n' +
    'Approved UPS start-up procedure,Submittal,A110,pm@example.com,2026-11-18,,open,SUB-0142\n',
};

export function parseCsv(kind: CsvKind, content: string): ImportPlan {
  const plan = emptyPlan(`csv:${kind}`);
  const parsed = Papa.parse<Record<string, string>>(content.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy' });
  if (!parsed.data.length) {
    plan.errors.push({ row: 0, message: 'The file has no rows.' });
    return plan;
  }
  const headers = parsed.meta.fields ?? [];
  const map: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(ALIASES[kind])) {
    const h = headers.find((h) => aliases.includes(norm(h)));
    if (h) map[field] = h;
  }
  const get = (r: Record<string, string>, f: string) => (map[f] ? (r[map[f]] ?? '').trim() : '');
  const required: Record<CsvKind, string[]> = { activities: ['name', 'start', 'finish'], equipment: ['tag'], constraints: ['description', 'category'] };
  const missing = required[kind].filter((f) => !map[f]);
  if (missing.length) {
    plan.errors.push({ row: 0, message: `Missing column(s): ${missing.join(', ')}. Download the template to see the expected headers.` });
    return plan;
  }

  parsed.data.forEach((r, i) => {
    const row = i + 2; // header is row 1
    const date = (f: string, req = false) => {
      const raw = get(r, f);
      if (!raw) {
        if (req) plan.errors.push({ row, message: `${f} is required.` });
        return null;
      }
      const d = parseDateLoose(raw);
      if (!d || !validDate(d)) {
        plan.errors.push({ row, message: `"${raw}" is not a date (${f}).` });
        return null;
      }
      return d;
    };
    if (kind === 'activities') {
      const name = get(r, 'name');
      if (!name) return plan.errors.push({ row, message: 'name is required.' });
      const start = date('start', true);
      const finish = date('finish', true);
      if (!start || !finish) return;
      if (finish < start) return plan.errors.push({ row, message: 'finish is before start.' });
      const lvl = parseIntLoose(get(r, 'cxLevel'));
      plan.activities.push({
        ref: get(r, 'ref') || null, name, area: get(r, 'area') || null, system: get(r, 'system') || null, trade: get(r, 'trade') || null,
        start, finish, actualStart: date('actualStart'), actualFinish: date('actualFinish'), crewSize: parseIntLoose(get(r, 'crewSize')),
        cxLevel: lvl && lvl >= 1 && lvl <= 5 ? lvl : null, predecessorRefs: splitList(get(r, 'predecessors')),
      });
    } else if (kind === 'equipment') {
      const tag = get(r, 'tag');
      if (!tag) return plan.errors.push({ row, message: 'tag is required.' });
      plan.equipment.push({
        tag, description: get(r, 'description') || null, vendor: get(r, 'vendor') || null, system: get(r, 'system') || null, area: get(r, 'area') || null,
        requiredOnSite: date('requiredOnSite'), promisedDelivery: date('promisedDelivery'), actualDelivery: date('actualDelivery'),
        startupNeeded: parseBool(get(r, 'startupNeeded')), witnessNeeded: parseBool(get(r, 'witnessNeeded')), activityRefs: splitList(get(r, 'activities')),
      });
    } else {
      const description = get(r, 'description');
      if (!description) return plan.errors.push({ row, message: 'description is required.' });
      const category = parseCategory(get(r, 'category'));
      if (!category) return plan.errors.push({ row, message: `Unknown category "${get(r, 'category')}".` });
      const st = get(r, 'status').toLowerCase();
      plan.constraints.push({
        description, category, activity: get(r, 'activity') || null, ownerEmail: get(r, 'owner') || null,
        neededBy: date('neededBy'), promisedDate: date('promisedDate'),
        status: st.startsWith('clear') || st === 'closed' ? 'cleared' : st.startsWith('prom') ? 'promised' : 'open',
        refNumber: get(r, 'refNumber') || null,
      });
    }
  });
  return plan;
}
