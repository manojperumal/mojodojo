// NFR-03: full audit trail on dates, owners and readiness overrides.
import type { Db } from './db';

export interface Actor {
  id?: string | null;
  name: string;
}

export async function audit(
  db: Db,
  e: { projectId: string; entityType: string; entityId: string; action: string; changes?: object; actor: Actor },
) {
  await db.query(
    `insert into audit_log (project_id, entity_type, entity_id, action, changes, actor_user_id, actor_name)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [e.projectId, e.entityType, e.entityId, e.action, JSON.stringify(e.changes ?? {}), e.actor.id ?? null, e.actor.name],
  );
}

/** Field-level diff for the keys present in `patch`. */
export function diff(before: Record<string, unknown>, patch: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const prev = before[k];
    if (JSON.stringify(prev ?? null) !== JSON.stringify(v ?? null)) out[k] = { from: prev ?? null, to: v ?? null };
  }
  return out;
}
