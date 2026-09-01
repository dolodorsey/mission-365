-- Ensure every Mission 365 auth account receives the baseline profile and
-- notification-preference records required by the app. Role activation remains
-- explicit through mission365-entry and is intentionally not inferred here.

create or replace function public.mission365_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mission365_profiles(user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(coalesce(new.email, 'Mission 365 Member'), '@', 1)
    )
  )
  on conflict (user_id) do nothing;

  insert into public.mission365_notification_preferences(user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.mission365_handle_new_user() from public, anon, authenticated;

drop trigger if exists mission365_on_auth_user_created on auth.users;
create trigger mission365_on_auth_user_created
after insert on auth.users
for each row execute function public.mission365_handle_new_user();

-- Repair historical auth accounts that predate the provisioning trigger.
insert into public.mission365_profiles(user_id, display_name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(u.email, 'Mission 365 Member'), '@', 1)
  )
from auth.users u
left join public.mission365_profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

insert into public.mission365_notification_preferences(user_id)
select u.id
from auth.users u
left join public.mission365_notification_preferences n on n.user_id = u.id
where n.user_id is null
on conflict (user_id) do nothing;
