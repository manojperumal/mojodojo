// P6 file import (decision D-1): XER (tab-delimited export) and PMXML. One-way; no live sync.
// Imports activities overlapping the lookahead window, their predecessors, WBS → area,
// activity codes → area / system / trade / Cx level, and P6 milestones → milestones.
import { XMLParser } from 'fast-xml-parser';
import { emptyPlan, parseDateLoose, parseIntLoose, type ImpActivity, type ImportPlan } from './normalize';

export interface P6Options {
  from: string; // include activities finishing on/after this date
  to: string; // and starting on/before this date
}

type Table = Record<string, string>[];

export function parseXerTables(content: string): Record<string, Table> {
  const tables: Record<string, Table> = {};
  let current: string | null = null;
  let fields: string[] = [];
  for (const raw of content.split(/\r?\n/)) {
    if (!raw) continue;
    const parts = raw.split('\t');
    const tag = parts[0];
    if (tag === '%T') {
      current = parts[1]?.trim();
      tables[current] = [];
      fields = [];
    } else if (tag === '%F') {
      fields = parts.slice(1).map((f) => f.trim());
    } else if (tag === '%R' && current) {
      const row: Record<string, string> = {};
      fields.forEach((f, i) => (row[f] = (parts[i + 1] ?? '').trim()));
      tables[current].push(row);
    }
  }
  return tables;
}

const isMilestoneType = (t: string) => /mile/i.test(t);

function classifyCode(typeName: string): 'area' | 'system' | 'trade' | 'level' | null {
  if (/system/i.test(typeName)) return 'system';
  if (/trade|resp|contractor|subcontract|discipline|crew/i.test(typeName)) return 'trade';
  if (/cx|commission|level/i.test(typeName)) return 'level';
  if (/area|zone|location|building|hall|pod|room|floor/i.test(typeName)) return 'area';
  return null;
}

function finish(plan: ImportPlan, all: ImpActivity[], opts: P6Options, milestones: { name: string; date: string | null; ref: string }[]) {
  const inWindow = all.filter((a) => a.finish >= opts.from && a.start <= opts.to && !(a.actualFinish && a.actualFinish < opts.from));
  const kept = new Set(inWindow.map((a) => a.ref));
  let dropped = 0;
  for (const a of inWindow) {
    const preds = a.predecessorRefs ?? [];
    a.predecessorRefs = preds.filter((p) => kept.has(p));
    dropped += preds.length - a.predecessorRefs.length;
  }
  plan.activities = inWindow;
  plan.milestones = milestones.filter((m) => m.date && m.date >= opts.from && m.date <= opts.to).map((m) => ({ name: m.name, targetDate: m.date!, ref: m.ref }));
  plan.warnings.push(`${all.length} activities in the file; ${inWindow.length} fall in the window ${opts.from} → ${opts.to}.`);
  if (dropped) plan.warnings.push(`${dropped} predecessor link(s) point outside the window and were skipped.`);
  return plan;
}

export function parseXer(content: string, opts: P6Options): ImportPlan {
  const plan = emptyPlan('p6:xer');
  const t = parseXerTables(content);
  if (!t.TASK) {
    plan.errors.push({ row: 0, message: 'This does not look like a P6 XER file (no TASK table).' });
    return plan;
  }
  if ((t.PROJECT?.length ?? 0) > 1) plan.warnings.push(`File has ${t.PROJECT.length} projects; all were read.`);

  const wbsName = new Map((t.PROJWBS ?? []).map((w) => [w.wbs_id, w.wbs_name || w.wbs_short_name]));
  const codeType = new Map((t.ACTVTYPE ?? []).map((c) => [c.actv_code_type_id, classifyCode(c.actv_code_type ?? '')]));
  const codeVal = new Map((t.ACTVCODE ?? []).map((c) => [c.actv_code_id, c.actv_code_name || c.short_name]));
  const codesByTask = new Map<string, { area?: string; system?: string; trade?: string; level?: number }>();
  for (const a of t.TASKACTV ?? []) {
    const kind = codeType.get(a.actv_code_type_id);
    const val = codeVal.get(a.actv_code_id);
    if (!kind || !val) continue;
    const entry = codesByTask.get(a.task_id) ?? {};
    if (kind === 'level') {
      const n = parseIntLoose(val);
      if (n && n >= 1 && n <= 5) entry.level = n;
    } else entry[kind] = val;
    codesByTask.set(a.task_id, entry);
  }
  const codeById = new Map(t.TASK.map((x) => [x.task_id, x.task_code || x.task_id]));
  const preds = new Map<string, string[]>();
  for (const p of t.TASKPRED ?? []) {
    const succ = p.task_id;
    const pred = codeById.get(p.pred_task_id);
    if (pred) preds.set(succ, [...(preds.get(succ) ?? []), pred]);
  }

  const all: ImpActivity[] = [];
  const milestones: { name: string; date: string | null; ref: string }[] = [];
  for (const x of t.TASK) {
    const start = parseDateLoose(x.act_start_date || x.target_start_date || x.early_start_date || x.restart_date);
    const fin = parseDateLoose(x.act_end_date || x.target_end_date || x.early_end_date || x.reend_date) ?? start;
    const ref = x.task_code || x.task_id;
    if (isMilestoneType(x.task_type ?? '')) {
      milestones.push({ name: x.task_name, date: start ?? fin, ref });
      continue;
    }
    if (!start || !fin) {
      plan.warnings.push(`Skipped ${ref} "${x.task_name}": no dates.`);
      continue;
    }
    const codes = codesByTask.get(x.task_id) ?? {};
    all.push({
      ref, name: x.task_name, start, finish: fin < start ? start : fin,
      actualStart: parseDateLoose(x.act_start_date), actualFinish: parseDateLoose(x.act_end_date),
      area: codes.area ?? wbsName.get(x.wbs_id) ?? null, system: codes.system ?? null, trade: codes.trade ?? null, cxLevel: codes.level ?? null,
      predecessorRefs: preds.get(x.task_id) ?? [],
    });
  }
  return finish(plan, all, opts, milestones);
}

const arr = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

export function parseP6Xml(content: string, opts: P6Options): ImportPlan {
  const plan = emptyPlan('p6:xml');
  let doc: any;
  try {
    doc = new XMLParser({ ignoreAttributes: true, parseTagValue: false }).parse(content);
  } catch {
    plan.errors.push({ row: 0, message: 'Could not read the XML file.' });
    return plan;
  }
  const root = doc.APIBusinessObjects ?? doc;
  const projects = arr<any>(root.Project);
  if (!projects.length) {
    plan.errors.push({ row: 0, message: 'This does not look like a P6 XML (PMXML) export (no <Project>).' });
    return plan;
  }
  const activities = projects.flatMap((p) => arr<any>(p.Activity));
  const wbs = new Map(projects.flatMap((p) => arr<any>(p.WBS)).map((w) => [String(w.ObjectId), String(w.Name ?? w.Code ?? '')]));
  const relationships = [...arr<any>(root.Relationship), ...projects.flatMap((p) => arr<any>(p.Relationship))];
  const idByObject = new Map(activities.map((a) => [String(a.ObjectId), String(a.Id ?? a.ObjectId)]));
  const preds = new Map<string, string[]>();
  for (const r of relationships) {
    const succ = String(r.SuccessorActivityObjectId);
    const pred = idByObject.get(String(r.PredecessorActivityObjectId));
    if (pred) preds.set(succ, [...(preds.get(succ) ?? []), pred]);
  }
  const all: ImpActivity[] = [];
  const milestones: { name: string; date: string | null; ref: string }[] = [];
  for (const a of activities) {
    const ref = String(a.Id ?? a.ObjectId);
    const start = parseDateLoose(a.ActualStartDate || a.PlannedStartDate || a.StartDate);
    const fin = parseDateLoose(a.ActualFinishDate || a.PlannedFinishDate || a.FinishDate) ?? start;
    if (isMilestoneType(String(a.Type ?? ''))) {
      milestones.push({ name: String(a.Name), date: start ?? fin, ref });
      continue;
    }
    if (!start || !fin) continue;
    all.push({
      ref, name: String(a.Name), start, finish: fin < start ? start : fin,
      actualStart: parseDateLoose(a.ActualStartDate), actualFinish: parseDateLoose(a.ActualFinishDate),
      area: wbs.get(String(a.WBSObjectId)) ?? null, predecessorRefs: preds.get(String(a.ObjectId)) ?? [],
    });
  }
  plan.warnings.push('P6 XML: WBS is mapped to area. Activity codes (system / trade) are read from XER exports only.');
  return finish(plan, all, opts, milestones);
}

export function parseP6(content: string, filename: string, opts: P6Options): ImportPlan {
  const looksXml = /\.xml$/i.test(filename) || content.trimStart().startsWith('<');
  return looksXml ? parseP6Xml(content, opts) : parseXer(content, opts);
}
