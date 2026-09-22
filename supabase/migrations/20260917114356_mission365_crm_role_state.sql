-- Preserve the existing queue contract, but derive activation from current roles.
-- Inactive roles must not imply approval, fundraising eligibility or activation.
create or replace function public.mission365_queue_crm_on_role_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  affected_user uuid;
  event_payload jsonb;
begin
  if tg_op = 'DELETE' then
    affected_user := old.user_id;
    -- Parent deletion cascades must not recreate CRM links or queued work.
    if not exists(select 1 from auth.users where id=affected_user) then
      return old;
    end if;
    event_payload := jsonb_build_object('app','mission365','user_id',affected_user,
      'role',old.role,'status',null,'operation','DELETE','previous_status',old.status);
  else
    affected_user := new.user_id;
    event_payload := jsonb_build_object('app','mission365','user_id',affected_user,
      'role',new.role,'status',new.status);
  end if;

  insert into public.mission365_crm_links(user_id)
  values(affected_user) on conflict(user_id) do nothing;

  -- Serialize updates to one user's link before reading their current roles.
  perform 1 from public.mission365_crm_links
  where user_id=affected_user for update;

  update public.mission365_crm_links
  set onboarding_stage=case when exists (
    select 1 from public.mission365_user_roles
    where user_id=affected_user and status='active'
  ) then 'role_activated' else 'account_created' end,
  updated_at=now()
  where user_id=affected_user;

  insert into public.mission365_crm_outbox(user_id,event_type,payload)
  values(affected_user,'role.changed',event_payload);
  if tg_op = 'DELETE' then return old; end if;
  return new;
exception when others then
  raise warning 'mission365_queue_crm_on_role_change failed for %: % [%]',affected_user,sqlerrm,sqlstate;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.mission365_queue_crm_on_role_change() from public,anon,authenticated;

-- This pending migration covers removal as well as status changes.
drop trigger if exists mission365_crm_on_role_change on public.mission365_user_roles;
create trigger mission365_crm_on_role_change
after insert or update of status or delete on public.mission365_user_roles
for each row execute function public.mission365_queue_crm_on_role_change();
