grant usage on schema mission365_private to authenticated;

create or replace function mission365_private.can_manage_public_profile_asset(p_profile_id text)
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','public','mission365_private'
as $fn$
  select exists (
    select 1
    from public.mission365_mission_profiles p
    join public.mission365_missions m on m.id=p.mission_id
    join public.mission365_organization_members om on om.organization_id=m.organization_id
    where p.id::text=p_profile_id
      and om.user_id=auth.uid()
      and om.member_role in ('owner','manager')
  );
$fn$;

revoke all on function mission365_private.can_manage_public_profile_asset(text) from public,anon;
grant execute on function mission365_private.can_manage_public_profile_asset(text) to authenticated;

drop policy if exists mission365_public_assets_owner_insert on storage.objects;
create policy mission365_public_assets_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='mission365-public'
  and (storage.foldername(name))[1]=auth.uid()::text
  and mission365_private.can_manage_public_profile_asset((storage.foldername(name))[2])
);

drop policy if exists mission365_public_assets_owner_update on storage.objects;
create policy mission365_public_assets_owner_update
on storage.objects for update to authenticated
using (
  bucket_id='mission365-public'
  and owner_id=auth.uid()::text
)
with check (
  bucket_id='mission365-public'
  and owner_id=auth.uid()::text
  and (storage.foldername(name))[1]=auth.uid()::text
  and mission365_private.can_manage_public_profile_asset((storage.foldername(name))[2])
);

drop function if exists public.mission365_can_manage_public_profile_asset(text);
