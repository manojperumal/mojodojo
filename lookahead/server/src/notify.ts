import { appUrl, sendEmail } from './email';
import { q, type Db } from './db';

export interface NotifyInput {
  projectId: string;
  userIds: string[];
  kind: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  email?: boolean;
}

/** In-app notification + email (FR-05: escalations are in-app and by email in V1). */
export async function notify(db: Db, n: NotifyInput) {
  const ids = [...new Set(n.userIds.filter(Boolean))];
  if (!ids.length) return;
  const users = await q<{ id: string; email: string; name: string }>(db, 'select id, email, name from users where id = any($1)', [ids]);
  for (const u of users) {
    const [row] = await q<{ id: string }>(
      db,
      `insert into notifications (project_id, user_id, kind, title, body, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [n.projectId, u.id, n.kind, n.title, n.body ?? null, n.entityType ?? null, n.entityId ?? null],
    );
    if (n.email !== false) {
      const link = n.link ? `${appUrl()}${n.link}` : appUrl();
      const ok = await sendEmail(u.email, n.title, `Hi ${u.name},\n\n${n.body ?? n.title}\n\nOpen in Lookahead: ${link}\n`);
      if (ok) await db.query('update notifications set emailed_at = now() where id = $1', [row.id]);
    }
  }
}
