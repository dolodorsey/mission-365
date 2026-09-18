create or replace function public.mission365_can_manage_public_profile_asset(p_profile_id text)
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','public'
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

revoke all on function public.mission365_can_manage_public_profile_asset(text) from public,anon;
grant execute on function public.mission365_can_manage_public_profile_asset(text) to authenticated;

drop policy if exists mission365_public_assets_owner_insert on storage.objects;
create policy mission365_public_assets_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='mission365-public'
  and (storage.foldername(name))[1]=auth.uid()::text
  and public.mission365_can_manage_public_profile_asset((storage.foldername(name))[2])
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
  and public.mission365_can_manage_public_profile_asset((storage.foldername(name))[2])
);

revoke insert on table public.mission365_documents from authenticated;
grant insert (
  application_id,
  uploaded_by,
  document_type,
  storage_bucket,
  storage_path,
  review_status
) on table public.mission365_documents to authenticated;

drop policy if exists mission365_documents_owner_insert on public.mission365_documents;
create policy mission365_documents_owner_insert
on public.mission365_documents for insert to authenticated
with check (
  uploaded_by=auth.uid()
  and organization_id is null
  and mission_id is null
  and milestone_id is null
  and impact_update_id is null
  and reviewed_by is null
  and reviewed_at is null
  and review_note is null
  and rejection_reason is null
  and review_status='pending'
  and storage_bucket='mission365-private'
  and document_type in (
    'ein_document','formation_document','nonprofit_status','authorized_representative',
    'ein_w9','business_registration','supporting_agreement','impact_evidence','other'
  )
  and storage_path like (
    auth.uid()::text||'/applications/'||application_id::text||'/'||document_type||'/%'
  )
  and exists (
    select 1
    from public.mission365_applications a
    where a.id=mission365_documents.application_id
      and a.applicant_user_id=auth.uid()
      and a.status in ('draft','documents_required','needs_information','waitlisted')
  )
);
