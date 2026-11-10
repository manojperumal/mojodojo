// FR-15 import to start: CSV, P6 file (decision D-1), and pre-commissioning templates (§9).
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileUp } from 'lucide-react';
import { addDays, weekStart } from '@lookahead/shared';
import { api, apiUrl } from '../lib/api';
import { useAct, useBundle, usePid } from '../lib/hooks';
import { Badge, Button, Card, Field, Input, Select, Tabs, toast } from '../components/ui';

type Kind = 'activities' | 'equipment' | 'constraints';

export function ImportPage() {
  const [tab, setTab] = useState<'csv' | 'p6' | 'template'>('template');
  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">Load the plan</h1>
        <p className="text-sm text-slate-600">Start from a template, import a P6 export, or bring a spreadsheet. Imports are one-way and safe to re-run: rows are matched by activity ID, equipment tag, or RFI / submittal number.</p>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'template', label: 'Pre-commissioning template' }, { value: 'p6', label: 'P6 file (XER / XML)' }, { value: 'csv', label: 'CSV / spreadsheet' }]} />
      {tab === 'template' && <TemplateTab />}
      {tab === 'p6' && <P6Tab />}
      {tab === 'csv' && <CsvTab />}
    </div>
  );
}

async function readFile(f: File) {
  if (f.size > 25 * 1024 * 1024) throw new Error('File is larger than 25 MB.');
  return f.text();
}

function Preview({ data }: { data: any }) {
  if (!data) return null;
  const cols: Record<string, string[]> = {
    activities: ['ref', 'name', 'area', 'system', 'trade', 'start', 'finish', 'crewSize', 'cxLevel'],
    equipment: ['tag', 'description', 'system', 'requiredOnSite', 'promisedDelivery', 'actualDelivery'],
    constraints: ['description', 'category', 'activity', 'ownerEmail', 'neededBy', 'status', 'refNumber'],
    milestones: ['name', 'targetDate'],
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(data.counts).filter(([, n]) => (n as number) > 0).map(([k, n]) => <Badge key={k} tone="dark">{n as number} {k}</Badge>)}
        {data.errors.length > 0 && <Badge tone="red">{data.errors.length} row error(s)</Badge>}
      </div>
      {data.warnings.map((w: string, i: number) => <p key={i} className="text-sm text-slate-600">{w}</p>)}
      {data.errors.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-risk-600/30 bg-risk-50 p-2 text-sm text-risk-700">
          {data.errors.map((e: any, i: number) => <li key={i}>{e.row ? `Row ${e.row}: ` : ''}{e.message}</li>)}
        </ul>
      )}
      {Object.entries(data.sample).filter(([, xs]) => (xs as any[]).length > 0).map(([k, xs]) => (
        <div key={k} className="overflow-x-auto rounded-md border">
          <div className="border-b bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase text-slate-500">{k} (first {(xs as any[]).length})</div>
          <table className="w-full text-xs">
            <thead><tr>{cols[k].map((c) => <th key={c} className="px-2 py-1 text-left text-slate-500">{c}</th>)}</tr></thead>
            <tbody>{(xs as any[]).map((r, i) => <tr key={i} className="border-t">{cols[k].map((c) => <td key={c} className="px-2 py-1">{String(r[c] ?? '')}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ))}
      {data.result && (
        <p className="rounded-md bg-ready-50 p-3 text-sm font-medium text-ready-700">
          Imported: {data.result.activities.created} new / {data.result.activities.updated} updated activities · {data.result.equipment.created + data.result.equipment.updated} equipment · {data.result.constraints.created + data.result.constraints.updated} constraints · {data.result.milestones.created} milestones.
          {data.result.errors.length > 0 && ` ${data.result.errors.length} row(s) skipped.`}
        </p>
      )}
    </div>
  );
}

function CsvTab() {
  const pid = usePid();
  const { run, pending } = useAct();
  const [kind, setKind] = useState<Kind>('activities');
  const [content, setContent] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const go = async (commit: boolean) => setPreview(await run(`/projects/${pid}/import/csv`, { kind, content, commit }, 'POST', commit ? 'Import complete' : undefined));
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-[220px_1fr_auto] sm:items-end">
        <Field label="What’s in the file?">
          <Select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setPreview(null); }}>
            <option value="activities">Activities</option>
            <option value="equipment">Equipment</option>
            <option value="constraints">Constraints (incl. RFIs, submittals)</option>
          </Select>
        </Field>
        <Field label="CSV file" hint={name || 'Save Excel sheets as CSV.'}>
          <Input type="file" accept=".csv,text/csv" className="pt-1.5" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setName(f.name); setContent(await readFile(f)); setPreview(null); }} />
        </Field>
        <a href={apiUrl(`/csv-templates/${kind}`)} className="inline-flex h-9 items-center gap-1 text-sm text-slate-600 underline-offset-2 hover:underline"><Download className="h-4 w-4" /> Template</a>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {kind === 'activities' && 'Columns: id, name, area, system, trade, start, finish, crew_size, cx_level, predecessors (ids separated by ;). Areas, systems and trades are created by name.'}
        {kind === 'equipment' && 'Columns: tag, description, vendor, system, area, required_on_site, promised_delivery, actual_delivery, startup_needed, witness_needed, activities.'}
        {kind === 'constraints' && 'Columns: description, category, activity (id or name), owner_email, needed_by, promised_date, status, ref_number. Rows without an owner and needed-by date are rejected (FR-04).'}
      </p>
      <div className="mt-3 flex gap-2">
        <Button disabled={!content} loading={pending} onClick={() => go(false)}><FileUp className="h-4 w-4" /> Preview</Button>
        <Button variant="primary" disabled={!preview || !!preview.result} loading={pending} onClick={() => go(true)}>Import</Button>
      </div>
      <div className="mt-4"><Preview data={preview} /></div>
    </Card>
  );
}

function P6Tab() {
  const { data: b } = useBundle();
  const { run, pending } = useAct();
  const thisWeek = b ? weekStart(b.today) : '';
  const [from, setFrom] = useState(addDays(thisWeek, -14));
  const [to, setTo] = useState(addDays(thisWeek, 83));
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [preview, setPreview] = useState<any>(null);
  if (!b) return null;
  const go = async (commit: boolean) => setPreview(await run(`/projects/${b.project.id}/import/p6`, { content: file!.content, filename: file!.name, from, to, commit }, 'POST', commit ? 'P6 import complete' : undefined));
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="P6 export" hint={file?.name ?? 'XER (recommended) or PMXML'}>
          <Input type="file" accept=".xer,.xml" className="pt-1.5" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setFile({ name: f.name, content: await readFile(f) }); setPreview(null); } catch (err) { toast((err as Error).message, 'error'); } }} />
        </Field>
        <Field label="Import activities from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="to"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Brings in activities overlapping the window with their predecessors. WBS maps to area; activity codes named like “Area”, “System”, “Trade / Responsibility” and “Cx Level” map to those fields. P6 milestones become milestones. Re-importing updates dates by activity ID; your constraints and tasks are kept. The master schedule stays the commercial record.
      </p>
      <div className="mt-3 flex gap-2">
        <Button disabled={!file} loading={pending} onClick={() => go(false)}><FileUp className="h-4 w-4" /> Preview</Button>
        <Button variant="primary" disabled={!preview || preview.errors.length > 0 || !!preview.result} loading={pending} onClick={() => go(true)}>Import</Button>
      </div>
      <div className="mt-4"><Preview data={preview} /></div>
    </Card>
  );
}

function TemplateTab() {
  const { data: b } = useBundle();
  const { run, pending } = useAct();
  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: () => api<any[]>('/templates') });
  const [systemId, setSystemId] = useState('');
  const [key, setKey] = useState('');
  const [anchor, setAnchor] = useState(b ? addDays(weekStart(b.today), 7) : '');
  if (!b) return null;
  const sys = b.systems.find((s) => s.id === systemId);
  const tplKey = key || (sys && templates?.find((t) => t.systemType === sys.systemType)?.key) || '';
  return (
    <Card>
      <p className="mb-3 text-sm text-slate-600">Generates the standard L2–L3 activities, crew tasks, constraints (with owners and needed-by dates) and energization gate for one system — so you start from ~80% complete instead of a blank board. Add the system under Setup first.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="System">
          <Select value={systemId} onChange={(e) => { setSystemId(e.target.value); setKey(''); }}>
            <option value="">Choose…</option>
            {b.systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Template">
          <Select value={tplKey} onChange={(e) => setKey(e.target.value)}>
            <option value="">Choose…</option>
            {templates?.map((t) => <option key={t.key} value={t.key}>{t.label} — {t.activities} activities, {t.constraints} constraints</option>)}
          </Select>
        </Field>
        <Field label="L2 start date" hint="Everything is scheduled from this date.">
          <Input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
        </Field>
      </div>
      <Button className="mt-3" variant="primary" disabled={!systemId || !tplKey || !anchor} loading={pending} onClick={async () => { const r = await run(`/projects/${b.project.id}/templates/apply`, { systemId, templateKey: tplKey, anchorDate: anchor }, 'POST'); toast(`Added ${r.activities} activities, ${r.constraints} constraints, ${r.milestones} milestones`); }}>
        Apply template
      </Button>
    </Card>
  );
}
