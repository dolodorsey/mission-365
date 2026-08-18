-- Restrict authenticated public-media uploads to Mission 365 profiles the
-- caller is allowed to manage. This prevents authenticated users from using
-- the public bucket as arbitrary storage under another profile ID.

drop policy if exists mission365_public_assets_owner_insert
on storage.objects;

create policy mission365_public_assets_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'mission365-public'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.mission365_mission_profiles p
    join public.mission365_missions m on m.id = p.mission_id
    join public.mission365_organization_members om on om.organization_id = m.organization_id
    where p.id::text = (storage.foldername(name))[2]
      and om.user_id = (select auth.uid())
      and om.member_role in ('owner','manager')
  )
);

drop policy if exists mission365_public_assets_owner_update
on storage.objects;

create policy mission365_public_assets_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'mission365-public'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'mission365-public'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.mission365_mission_profiles p
    join public.mission365_missions m on m.id = p.mission_id
    join public.mission365_organization_members om on om.organization_id = m.organization_id
    where p.id::text = (storage.foldername(name))[2]
      and om.user_id = (select auth.uid())
      and om.member_role in ('owner','manager')
  )
);
