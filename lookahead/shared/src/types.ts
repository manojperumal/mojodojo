import type {
  AreaKind,
  ConstraintCategory,
  ConstraintStatus,
  MilestoneKind,
  Readiness,
  Role,
  SystemType,
  VarianceReason,
} from './constants';
import type { ISODate } from './dates';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  timezone: string;
  workDays: number;
  lastRolledWeek: ISODate | null;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  projectId: string;
  userId: string;
  role: Role;
  tradeId: string | null;
  name: string;
  email: string;
}

export interface Trade {
  id: string;
  projectId: string;
  name: string;
  company: string | null;
  foremanName: string | null;
  foremanEmail: string | null;
  foremanPhone: string | null;
}

export interface Area {
  id: string;
  projectId: string;
  name: string;
  kind: AreaKind;
  parentId: string | null;
}

export interface System {
  id: string;
  projectId: string;
  name: string;
  systemType: SystemType;
  areaId: string | null;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  kind: MilestoneKind;
  cxLevel: number | null;
  systemId: string | null;
  targetDate: ISODate | null;
  forecastDate: ISODate | null;
  confidence: 'high' | 'medium' | 'low' | null;
  authoriserUserId: string | null;
  gateConfirmedAt: string | null;
  gateConfirmedBy: string | null;
  activityIds: string[];
}

export interface Activity {
  id: string;
  projectId: string;
  name: string;
  areaId: string | null;
  systemId: string | null;
  tradeId: string | null;
  cxLevel: number | null;
  plannedStart: ISODate;
  plannedFinish: ISODate;
  actualStart: ISODate | null;
  actualFinish: ISODate | null;
  crewSize: number | null;
  externalRef: string | null;
  readinessOverride: Readiness | null;
  overrideNote: string | null;
  overrideBy: string | null;
  overrideAt: string | null;
  predecessorIds: string[];
  equipmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  activityId: string;
  name: string;
  tradeId: string | null;
  crewSize: number | null;
  plannedStart: ISODate;
  plannedFinish: ISODate;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: string;
  projectId: string;
  tag: string;
  description: string | null;
  vendor: string | null;
  systemId: string | null;
  areaId: string | null;
  requiredOnSite: ISODate | null;
  promisedDelivery: ISODate | null;
  actualDelivery: ISODate | null;
  startupNeeded: boolean;
  witnessNeeded: boolean;
  notes: string | null;
}

export interface Constraint {
  id: string;
  projectId: string;
  number: number;
  description: string;
  category: ConstraintCategory;
  activityId: string | null;
  taskId: string | null;
  milestoneId: string | null;
  equipmentId: string | null;
  ownerUserId: string | null;
  neededBy: ISODate | null;
  promisedDate: ISODate | null;
  status: ConstraintStatus;
  refNumber: string | null;
  raisedAt: string;
  raisedByUserId: string | null;
  raisedByName: string | null;
  clearedAt: string | null;
  clearedBy: string | null;
  clearanceNote: string | null;
  missedAt: string | null;
  varianceReason: VarianceReason | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConstraintComment {
  id: string;
  constraintId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export type CommitmentStatus = 'proposed' | 'confirmed' | 'done' | 'not_done';

export interface Commitment {
  id: string;
  projectId: string;
  weekStart: ISODate;
  taskId: string;
  tradeId: string | null;
  crewSize: number | null;
  promisedStart: ISODate | null;
  promisedFinish: ISODate | null;
  status: CommitmentStatus;
  confirmedAt: string | null;
  confirmedByName: string | null;
  varianceReason: VarianceReason | null;
  varianceNote: string | null;
  overridden: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  projectId: string | null;
  kind: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }> | Record<string, unknown>;
  actorName: string | null;
  createdAt: string;
}

export interface ReadinessReason {
  severity: Readiness; // 'constrained' | 'at_risk'
  text: string;
  constraintId?: string;
  equipmentId?: string;
  activityId?: string;
  milestoneId?: string;
}

export interface ReadinessResult {
  state: Readiness;
  computed: Readiness;
  overridden: boolean;
  reasons: ReadinessReason[];
  topConstraintId: string | null;
}

/** Everything the board, log, plan and huddle views need, in one payload (NFR-02). */
export interface ProjectBundle {
  project: Project;
  today: ISODate;
  myRole: Role;
  members: Member[];
  trades: Trade[];
  areas: Area[];
  systems: System[];
  milestones: Milestone[];
  activities: Activity[];
  tasks: Task[];
  equipment: Equipment[];
  constraints: Constraint[];
  commitments: Commitment[];
  readiness: Record<string, ReadinessResult>; // by activity id
  taskReadiness: Record<string, ReadinessResult>; // by task id
  gates: Record<string, GateStatus>; // by milestone id
}

export interface GateStatus {
  milestoneId: string;
  cleared: boolean;
  openConstraintIds: string[];
  atRisk: boolean;
  confirmed: boolean;
}
