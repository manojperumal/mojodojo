// FR-14 roles and permissions. Project-scoped; no cross-project visibility.
import type { Request } from 'express';
import type { Role } from '@lookahead/shared';
import { one, type Db, pool } from './db';
import { forbidden, notFound } from './errors';

export type Action =
  | 'read'
  | 'plan.edit' // activities, tasks, areas, systems, trades, milestones, members, import, overrides, weekly plan
  | 'constraint.create'
  | 'constraint.edit.any'
  | 'constraint.edit.own'
  | 'comment'
  | 'equipment.edit'
  | 'gate.confirm'
  | 'commit';

const MATRIX: Record<Action, Role[]> = {
  read: ['super', 'pm', 'field_engineer', 'foreman', 'cxa', 'owner_viewer'],
  'plan.edit': ['super'],
  'constraint.create': ['super', 'pm', 'field_engineer', 'foreman', 'cxa'],
  'constraint.edit.any': ['super'],
  'constraint.edit.own': ['super', 'pm', 'field_engineer', 'cxa', 'foreman'],
  comment: ['super', 'pm', 'field_engineer', 'foreman', 'cxa'],
  // Assumption: PM / field engineer own procurement dates, so they can update equipment dates.
  'equipment.edit': ['super', 'pm', 'field_engineer'],
  'gate.confirm': ['super', 'cxa'],
  commit: ['super', 'foreman'],
};

export const roleCan = (role: Role, action: Action) => MATRIX[action].includes(role);

export interface Membership {
  role: Role;
  tradeId: string | null;
}

export async function membership(projectId: string, userId: string, db: Db = pool): Promise<Membership | null> {
  return one<Membership>(db, 'select role, trade_id from project_members where project_id = $1 and user_id = $2', [projectId, userId]);
}

/** Loads the caller's membership and checks the action. Returns the membership. */
export async function authorize(req: Request, projectId: string, action: Action): Promise<Membership> {
  const m = await membership(projectId, req.user!.id);
  if (!m) throw notFound('Project not found.');
  if (!roleCan(m.role, action)) throw forbidden();
  return m;
}

/** Resolve the project that owns a row, so routes can authorize by entity id. */
export async function projectOf(table: string, id: string, db: Db = pool): Promise<string> {
  const allowed = ['activities', 'tasks', 'constraints', 'equipment', 'milestones', 'areas', 'systems', 'trades', 'commitments', 'foreman_links'];
  if (!allowed.includes(table)) throw new Error('bad table');
  const row = await one<{ projectId: string }>(db, `select project_id from ${table} where id = $1`, [id]);
  if (!row) throw notFound();
  return row.projectId;
}
