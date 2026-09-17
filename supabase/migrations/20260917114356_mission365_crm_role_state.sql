-- Preserve the existing queue contract, but derive activation from current roles.
-- Inactive roles must not imply approval, fundraising eligibility or activation.
create or replace function public.mission365_queue_crm_on_role_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.mission365_crm_links(user_id)
  values(new.user_id) on conflict(user_id) do nothing;

  -- Serialize updates to one user's link before reading their current roles.
  perform 1 from public.mission365_crm_links
  where user_id=new.user_id for update;

  update public.mission365_crm_links
  set onboarding_stage=case when exists (
    select 1 from public.mission365_user_roles
    where user_id=new.user_id and status='active'
  ) then 'role_activated' else 'account_created' end,
  updated_at=now()
  where user_id=new.user_id;

  insert into public.mission365_crm_outbox(user_id,event_type,payload)
  values(new.user_id,'role.changed',jsonb_build_object(
    'app','mission365','user_id',new.user_id,'role',new.role,'status',new.status));
  return new;
exception when others then
  raise warning 'mission365_queue_crm_on_role_change failed for %: % [%]',new.user_id,sqlerrm,sqlstate;
  return new;
end;
$$;
revoke all on function public.mission365_queue_crm_on_role_change() from public,anon,authenticated;
