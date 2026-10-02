-- Run against an EMPTY disposable PostgreSQL database with psql ON_ERROR_STOP=1.
-- Never run this fixture against a deployed project.
begin;
create schema auth;
create role anon;
create role authenticated;
create table auth.users(id uuid primary key);
create table public.mission365_user_roles(
  user_id uuid references auth.users(id) on delete cascade,role text,status text,
  primary key(user_id,role)
);
\ir ../supabase/migrations/20260901064300_mission365_crm_onboarding_bridge.sql
\ir ../supabase/migrations/20260917114356_mission365_crm_role_state.sql

insert into auth.users values ('00000000-0000-0000-0000-000000000001');
insert into auth.users values ('00000000-0000-0000-0000-000000000002');
insert into mission365_user_roles values
('00000000-0000-0000-0000-000000000001','mission_owner','inactive');
do $$ begin
 if (select onboarding_stage from mission365_crm_links where user_id='00000000-0000-0000-0000-000000000001') <> 'account_created' then raise exception 'Inactive insert falsely activated'; end if;
end $$;
update mission365_user_roles set status='active' where role='mission_owner';
do $$ begin
 if (select onboarding_stage from mission365_crm_links where user_id='00000000-0000-0000-0000-000000000001') <> 'role_activated' then raise exception 'Active update not reflected'; end if;
end $$;
insert into mission365_user_roles values
('00000000-0000-0000-0000-000000000001','volunteer','active');
update mission365_user_roles set status='inactive' where role='mission_owner';
do $$ begin
 if (select onboarding_stage from mission365_crm_links where user_id='00000000-0000-0000-0000-000000000001') <> 'role_activated' then raise exception 'Other active role ignored'; end if;
end $$;
update mission365_user_roles set status='inactive' where role='volunteer';
do $$ begin
 if (select onboarding_stage from mission365_crm_links where user_id='00000000-0000-0000-0000-000000000001') <> 'account_created' then raise exception 'Last role deactivation falsely retained activation'; end if;
 if (select onboarding_stage from mission365_crm_links where user_id='00000000-0000-0000-0000-000000000002') <> 'account_created' then raise exception 'Other user changed'; end if;
 if (select count(*) from mission365_crm_outbox where event_type='role.changed') <> 5 then raise exception 'Queue event count changed'; end if;
 if (select count(*) from mission365_crm_outbox where event_type='role.changed' and payload->>'app'='mission365' and payload->>'status'='inactive') <> 3 then raise exception 'Queue event payload changed'; end if;
 if exists(select 1 from mission365_crm_outbox where status<>'pending' or attempts<>0 or processed_at is not null) then raise exception 'Events unexpectedly processed'; end if;
 if has_function_privilege('anon','public.mission365_queue_crm_on_role_change()','EXECUTE') or has_function_privilege('authenticated','public.mission365_queue_crm_on_role_change()','EXECUTE') then raise exception 'Client execution exposed'; end if;
end $$;
rollback;
\echo 'PASS: nine role-state, isolation, queue and privilege assertions'
