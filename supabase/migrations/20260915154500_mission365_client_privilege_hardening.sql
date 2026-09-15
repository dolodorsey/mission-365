-- MISSION 365 ONLY
-- Remove schema privileges that browser/API client roles do not need.
-- Row-level security remains the authorization boundary for ordinary DML.
-- This migration intentionally preserves SELECT/INSERT/UPDATE/DELETE grants
-- already used by application flows and removes only DDL/destructive-style
-- table privileges that are unnecessary for anon/authenticated clients.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and tablename like 'mission365\_%' escape '\'
  loop
    execute format(
      'revoke truncate, references, trigger on table %I.%I from anon, authenticated',
      r.schemaname,
      r.tablename
    );
  end loop;
end
$$;
