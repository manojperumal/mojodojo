// FR-15 import to start: CSV, P6 file, and pre-commissioning templates.
import { Router } from 'express';
import { z } from 'zod';
import { addDays, TEMPLATES, todayIn, weekStart } from '@lookahead/shared';
import { authorize } from '../access';
import { loadProject } from '../bundle';
import { tx } from '../db';
import { bad, h } from '../errors';
import { applyImport, applyTemplate } from '../import/apply';
import { CSV_TEMPLATES, parseCsv } from '../import/csv';
import { parseP6 } from '../import/p6';
import type { ImportPlan } from '../import/normalize';

export const imports = Router();
/** No auth: static CSV templates, so a plain download link works. */
export const importsPublic = Router();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function preview(plan: ImportPlan) {
  return {
    source: plan.source,
    counts: { activities: plan.activities.length, equipment: plan.equipment.length, constraints: plan.constraints.length, milestones: plan.milestones.length },
    sample: { activities: plan.activities.slice(0, 20), equipment: plan.equipment.slice(0, 20), constraints: plan.constraints.slice(0, 20), milestones: plan.milestones.slice(0, 20) },
    warnings: plan.warnings,
    errors: plan.errors,
  };
}

importsPublic.get('/csv-templates/:kind', (req, res) => {
  const t = CSV_TEMPLATES[req.params.kind as keyof typeof CSV_TEMPLATES];
  if (!t) return res.status(404).end();
  res.type('text/csv').attachment(`lookahead-${req.params.kind}-template.csv`).send(t);
});

imports.get('/templates', (_req, res) => {
  res.json(TEMPLATES.map((t) => ({ key: t.key, label: t.label, systemType: t.systemType, activities: t.activities.length, constraints: t.activities.reduce((n, a) => n + a.constraints.length, 0) + t.milestones.reduce((n, m) => n + (m.gate?.length ?? 0), 0) })));
});

imports.post(
  '/projects/:pid/import/csv',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const body = z.object({ kind: z.enum(['activities', 'equipment', 'constraints']), content: z.string().min(1), commit: z.boolean().default(false) }).parse(req.body);
    const plan = parseCsv(body.kind, body.content);
    if (!body.commit) return res.json(preview(plan));
    if (plan.errors.length && !plan.activities.length && !plan.equipment.length && !plan.constraints.length) throw bad('Nothing to import — fix the errors first.', plan.errors);
    const result = await tx((c) => applyImport(c, req.params.pid, plan, req.user!));
    res.json({ ...preview(plan), result });
  }),
);

imports.post(
  '/projects/:pid/import/p6',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const p = await loadProject(req.params.pid);
    const thisWeek = weekStart(todayIn(p.timezone));
    const body = z
      .object({ content: z.string().min(1), filename: z.string().default('schedule.xer'), from: isoDate.optional(), to: isoDate.optional(), commit: z.boolean().default(false) })
      .parse(req.body);
    const plan = parseP6(body.content, body.filename, { from: body.from ?? addDays(thisWeek, -14), to: body.to ?? addDays(thisWeek, 7 * 12 - 1) });
    if (!body.commit) return res.json(preview(plan));
    if (plan.errors.length) throw bad(plan.errors[0].message, plan.errors);
    const result = await tx((c) => applyImport(c, req.params.pid, plan, req.user!));
    res.json({ ...preview(plan), result });
  }),
);

imports.post(
  '/projects/:pid/templates/apply',
  h(async (req, res) => {
    await authorize(req, req.params.pid, 'plan.edit');
    const body = z.object({ templateKey: z.string(), systemId: z.string().uuid(), anchorDate: isoDate, areaId: z.string().uuid().nullable().optional() }).parse(req.body);
    res.status(201).json(await tx((c) => applyTemplate(c, req.params.pid, body, req.user!)));
  }),
);
