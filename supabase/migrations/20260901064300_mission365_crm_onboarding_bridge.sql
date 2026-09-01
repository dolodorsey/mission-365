create table if not exists public.mission365_crm_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ghl_contact_id text unique,
  onboarding_stage text not null default 'account_created',
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','error','disabled')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission365_crm_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','processed','error')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists mission365_crm_outbox_pending_idx on public.mission365_crm_outbox(status,available_at,created_at);
alter table public.mission365_crm_links enable row level security;
alter table public.mission365_crm_outbox enable row level security;

create or replace function public.mission365_queue_crm_on_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.mission365_crm_links(user_id) values(new.id) on conflict(user_id) do nothing;
  insert into public.mission365_crm_outbox(user_id,event_type,payload)
  values(new.id,'user.signup',jsonb_build_object('app','mission365','user_id',new.id));
  return new;
exception when others then
  raise warning 'mission365_queue_crm_on_signup failed for %: % [%]',new.id,sqlerrm,sqlstate;
  return new;
end;
$$;
revoke all on function public.mission365_queue_crm_on_signup() from public,anon,authenticated;

drop trigger if exists mission365_crm_on_auth_user_created on auth.users;
create trigger mission365_crm_on_auth_user_created after insert on auth.users
for each row execute function public.mission365_queue_crm_on_signup();

create or replace function public.mission365_queue_crm_on_role_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.mission365_crm_links(user_id,onboarding_stage)
  values(new.user_id,'role_activated')
  on conflict(user_id) do update set onboarding_stage='role_activated',updated_at=now();
  insert into public.mission365_crm_outbox(user_id,event_type,payload)
  values(new.user_id,'role.changed',jsonb_build_object('app','mission365','user_id',new.user_id,'role',new.role,'status',new.status));
  return new;
exception when others then
  raise warning 'mission365_queue_crm_on_role_change failed for %: % [%]',new.user_id,sqlerrm,sqlstate;
  return new;
end;
$$;
revoke all on function public.mission365_queue_crm_on_role_change() from public,anon,authenticated;

drop trigger if exists mission365_crm_on_role_change on public.mission365_user_roles;
create trigger mission365_crm_on_role_change after insert or update of status on public.mission365_user_roles
for each row execute function public.mission365_queue_crm_on_role_change();

insert into public.mission365_crm_links(user_id,onboarding_stage)
select u.id,
  case when exists(select 1 from public.mission365_user_roles r where r.user_id=u.id and r.status='active')
       then 'role_activated' else 'account_created' end
from auth.users u
on conflict(user_id) do update set onboarding_stage=excluded.onboarding_stage,updated_at=now();

insert into public.mission365_crm_outbox(user_id,event_type,payload)
select l.user_id,'user.backfill',jsonb_build_object('app','mission365','user_id',l.user_id)
from public.mission365_crm_links l
where not exists (
  select 1 from public.mission365_crm_outbox o
  where o.user_id=l.user_id and o.event_type in ('user.signup','user.backfill')
);