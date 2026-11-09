import {
  addDays,
  computeReadiness,
  todayIn,
  weekStart,
  type Activity,
  type Commitment,
  type Constraint,
  type Equipment,
  type Milestone,
  type Project,
  type ProjectBundle,
  type Role,
  type Task,
} from '@lookahead/shared';
import { one, pool, q, type Db } from './db';
import { notFound } from './errors';

export async function loadProject(projectId: string, db: Db = pool): Promise<Project> {
  const p = await one<Project>(db, 'select * from projects where id = $1', [projectId]);
  if (!p) throw notFound('Project not found.');
  return p;
}

export async function projectToday(projectId: string, db: Db = pool) {
  const p = await loadProject(projectId, db);
  return todayIn(p.timezone);
}

export async function loadPlanData(projectId: string, db: Db = pool) {
  const [activities, tasks, constraints, equipment, milestones] = await Promise.all([
    q<Activity>(
      db,
      `select a.*,
         coalesce((select array_agg(predecessor_id) from activity_predecessors where activity_id = a.id), '{}') as predecessor_ids,
         coalesce((select array_agg(equipment_id) from activity_equipment where activity_id = a.id), '{}') as equipment_ids
       from activities a where project_id = $1 order by planned_start, name`,
      [projectId],
    ),
    q<Task>(db, 'select * from tasks where project_id = $1 order by planned_start, name', [projectId]),
    q<Constraint>(db, 'select * from constraints where project_id = $1 order by number', [projectId]),
    q<Equipment>(db, 'select * from equipment where project_id = $1 order by tag', [projectId]),
    q<Milestone>(
      db,
      `select m.*, coalesce((select array_agg(activity_id) from milestone_activities where milestone_id = m.id), '{}') as activity_ids
       from milestones m where project_id = $1 order by target_date nulls last, name`,
      [projectId],
    ),
  ]);
  return { activities, tasks, constraints, equipment, milestones };
}

export async function loadBundle(projectId: string, myRole: Role, db: Db = pool): Promise<ProjectBundle> {
  const project = await loadProject(projectId, db);
  const today = todayIn(project.timezone);
  const since = addDays(weekStart(today), -7 * 12);
  const [plan, members, trades, areas, systems, commitments] = await Promise.all([
    loadPlanData(projectId, db),
    q(
      db,
      `select pm.project_id, pm.user_id, pm.role, pm.trade_id, u.name, u.email
       from project_members pm join users u on u.id = pm.user_id where pm.project_id = $1 order by u.name`,
      [projectId],
    ),
    q(db, 'select * from trades where project_id = $1 order by name', [projectId]),
    q(db, 'select * from areas where project_id = $1 order by name', [projectId]),
    q(db, 'select * from systems where project_id = $1 order by name', [projectId]),
    q<Commitment>(db, 'select * from commitments where project_id = $1 and week_start >= $2 order by week_start', [projectId, since]),
  ]);
  const r = computeReadiness({ ...plan, today });
  return { project, today, myRole, members, trades, areas, systems, commitments, ...plan, ...r };
}
