import { useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '@lookahead/shared';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';

const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const val = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** NFR-03 audit trail for one record. */
export function History({ pid, entityType, entityId, names }: { pid: string; entityType: string; entityId: string; names?: Map<string, string> }) {
  const { data } = useQuery({
    queryKey: ['audit', pid, entityType, entityId],
    queryFn: () => api<AuditEntry[]>(`/projects/${pid}/audit?entityType=${entityType}&entityId=${entityId}`),
  });
  if (!data?.length) return <p className="text-sm text-slate-500">No changes recorded yet.</p>;
  const nm = (v: unknown) => (typeof v === 'string' && names?.get(v)) || val(v);
  return (
    <ol className="space-y-2 text-sm">
      {data.map((e) => (
        <li key={e.id} className="border-l-2 border-slate-200 pl-3">
          <div className="text-slate-500">
            <b className="text-slate-700">{e.actorName ?? 'System'}</b> · {e.action.replace(/_/g, ' ')} · {timeAgo(e.createdAt)}
          </div>
          <ul className="text-slate-700">
            {Object.entries(e.changes ?? {}).map(([k, v]) =>
              v && typeof v === 'object' && 'from' in (v as object) ? (
                <li key={k}>
                  {label(k)}: <s className="text-slate-400">{nm((v as any).from)}</s> → {nm((v as any).to)}
                </li>
              ) : (
                <li key={k}>
                  {label(k)}: {nm(v)}
                </li>
              ),
            )}
          </ul>
        </li>
      ))}
    </ol>
  );
}
