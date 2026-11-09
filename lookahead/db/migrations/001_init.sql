-- Lookahead V1 schema (PRD v0.1 §6). Runs on Supabase Postgres or any Postgres 14+.
create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  auth_user_id uuid unique,               -- Supabase auth.users.id once they sign in
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  timezone text not null default 'America/Chicago',
  work_days int not null default 5 check (work_days in (5, 6, 7)),
  last_rolled_week date,                  -- FR-13 Monday roll-forward
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trades (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  company text,
  foreman_name text,
  foreman_email text,
  foreman_phone text,
  unique (project_id, name)
);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('super','pm','field_engineer','foreman','cxa','owner_viewer')),
  trade_id uuid references trades(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table areas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  kind text not null default 'zone' check (kind in ('building','data_hall','pod','room','zone')),
  parent_id uuid references areas(id) on delete set null,
  unique (project_id, name)
);

create table systems (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  system_type text not null default 'other' check (system_type in ('ups','switchgear','generator','crah_chw','fire_alarm','other')),
  area_id uuid references areas(id) on delete set null,
  unique (project_id, name)
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  area_id uuid references areas(id) on delete set null,
  system_id uuid references systems(id) on delete set null,
  trade_id uuid references trades(id) on delete set null,
  cx_level int check (cx_level between 1 and 5),
  planned_start date not null,
  planned_finish date not null,
  actual_start date,
  actual_finish date,
  crew_size int check (crew_size >= 0),
  external_ref text,                      -- P6 activity id / CSV id
  readiness_override text check (readiness_override in ('ready','constrained','at_risk')),
  override_note text,
  override_by uuid references users(id),
  override_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  check (planned_finish >= planned_start),
  check (readiness_override is null or override_note is not null)
);
create index on activities (project_id, planned_start);
create unique index activities_external_ref on activities (project_id, external_ref) where external_ref is not null;

create table activity_predecessors (
  activity_id uuid not null references activities(id) on delete cascade,
  predecessor_id uuid not null references activities(id) on delete cascade,
  primary key (activity_id, predecessor_id),
  check (activity_id <> predecessor_id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  name text not null,
  trade_id uuid references trades(id) on delete set null,
  crew_size int check (crew_size >= 0),
  planned_start date not null,
  planned_finish date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_finish >= planned_start)
);
create index on tasks (activity_id);

create table equipment (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  tag text not null,
  description text,
  vendor text,
  system_id uuid references systems(id) on delete set null,
  area_id uuid references areas(id) on delete set null,
  required_on_site date,
  promised_delivery date,
  actual_delivery date,
  startup_needed boolean not null default false,
  witness_needed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, tag)
);

create table activity_equipment (
  activity_id uuid not null references activities(id) on delete cascade,
  equipment_id uuid not null references equipment(id) on delete cascade,
  primary key (activity_id, equipment_id)
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  kind text not null default 'milestone' check (kind in ('milestone','energization','cx_level')),
  cx_level int check (cx_level between 1 and 5),
  system_id uuid references systems(id) on delete set null,
  target_date date,
  forecast_date date,
  confidence text check (confidence in ('high','medium','low')),
  authoriser_user_id uuid references users(id),
  gate_confirmed_at timestamptz,
  gate_confirmed_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table milestone_activities (
  milestone_id uuid not null references milestones(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  primary key (milestone_id, activity_id)
);

create table constraints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  number int not null,
  description text not null,
  category text not null check (category in ('rfi','submittal','material_equipment','design_drawing','predecessor_work','labor_crew','permit_inspection','decision','vendor_startup','documentation','access_space','safety_energization')),
  activity_id uuid references activities(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  milestone_id uuid references milestones(id) on delete cascade,
  equipment_id uuid references equipment(id) on delete set null,
  owner_user_id uuid references users(id),
  needed_by date,
  promised_date date,
  status text not null default 'open' check (status in ('raised','open','promised','cleared','missed')),
  ref_number text,                        -- RFI / submittal number (FR-06)
  raised_at timestamptz not null default now(),
  raised_by_user_id uuid references users(id),
  raised_by_name text,                    -- foreman raising via link (no account)
  cleared_at timestamptz,
  cleared_by uuid references users(id),
  clearance_note text,
  missed_at timestamptz,
  variance_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number),
  -- FR-04: only a foreman-raised constraint may exist without owner + needed-by, and only as 'raised'
  check (status = 'raised' or (owner_user_id is not null and needed_by is not null))
);
create index on constraints (project_id, status);
create index on constraints (activity_id);

create table constraint_comments (
  id uuid primary key default gen_random_uuid(),
  constraint_id uuid not null references constraints(id) on delete cascade,
  author_user_id uuid references users(id),
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table commitments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  week_start date not null,
  task_id uuid not null references tasks(id) on delete cascade,
  trade_id uuid references trades(id) on delete set null,
  crew_size int,
  promised_start date,
  promised_finish date,
  status text not null default 'proposed' check (status in ('proposed','confirmed','done','not_done')),
  confirmed_at timestamptz,
  confirmed_by_name text,
  variance_reason text check (variance_reason in ('predecessor','material','labor','design_rfi','inspection','weather','equipment','planning_error','other')),
  variance_note text,
  overridden boolean not null default false, -- pulled in while not READY (FR-08)
  marked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, week_start),
  check (status <> 'not_done' or variance_reason is not null),
  check (variance_reason <> 'other' or variance_note is not null)
);
create index on commitments (project_id, week_start);

create table foreman_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  trade_id uuid not null references trades(id) on delete cascade,
  week_start date not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc);

create table escalations (
  constraint_id uuid not null references constraints(id) on delete cascade,
  level text not null check (level in ('owner_7d','owner_2d','super_due','pm_overdue_2d')),
  sent_at timestamptz not null default now(),
  primary key (constraint_id, level)
);

create table audit_log (                  -- NFR-03
  id bigserial primary key,
  project_id uuid references projects(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  changes jsonb not null default '{}',
  actor_user_id uuid references users(id),
  actor_name text,
  created_at timestamptz not null default now()
);
create index on audit_log (project_id, entity_type, entity_id);
