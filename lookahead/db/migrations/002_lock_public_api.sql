-- Supabase exposes the "public" schema through its auto-generated REST API, reachable with the
-- anon key that ships in every browser bundle. Lookahead never uses that API: only the server
-- talks to the database, as the owner role, which bypasses RLS. Enabling RLS with no policies
-- makes every table unreadable and unwritable through the public API.
-- Harmless on plain Postgres.
do $$
declare t text;
begin
  foreach t in array array[
    'users','projects','trades','project_members','areas','systems','activities','activity_predecessors',
    'tasks','equipment','activity_equipment','milestones','milestone_activities','constraints',
    'constraint_comments','commitments','foreman_links','notifications','escalations','audit_log','schema_migrations'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Belt and braces on Supabase: the API roles get no privileges at all.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all sequences in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on sequences from anon, authenticated';
  end if;
end $$;
