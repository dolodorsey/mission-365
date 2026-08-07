create or replace function public.mission365_get_runtime_secret(secret_name text)
returns text
language sql
stable
security definer
set search_path = vault, pg_temp
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  limit 1;
$$;

revoke all on function public.mission365_get_runtime_secret(text) from public, anon, authenticated;
grant execute on function public.mission365_get_runtime_secret(text) to service_role;

create index if not exists mission365_applications_organization_idx on public.mission365_applications(organization_id);
create index if not exists mission365_audit_actor_idx on public.mission365_audit_log(actor_user_id);
create index if not exists mission365_sponsorships_business_idx on public.mission365_business_sponsorships(business_organization_id);
create index if not exists mission365_documents_application_idx on public.mission365_documents(application_id);
create index if not exists mission365_documents_organization_idx on public.mission365_documents(organization_id);
create index if not exists mission365_documents_reviewed_by_idx on public.mission365_documents(reviewed_by);
create index if not exists mission365_documents_uploaded_by_idx on public.mission365_documents(uploaded_by);
create index if not exists mission365_donations_plan_idx on public.mission365_donations(giving_plan_id);
create index if not exists mission365_giving_plans_donor_idx on public.mission365_giving_plans(donor_user_id);
create index if not exists mission365_giving_plans_mission_idx on public.mission365_giving_plans(mission_id);
create index if not exists mission365_updates_author_idx on public.mission365_impact_updates(author_user_id);
create index if not exists mission365_updates_milestone_idx on public.mission365_impact_updates(milestone_id);
create index if not exists mission365_updates_mission_idx on public.mission365_impact_updates(mission_id);
create index if not exists mission365_milestones_mission_idx on public.mission365_milestones(mission_id);
create index if not exists mission365_missions_organization_idx on public.mission365_missions(organization_id);
create index if not exists mission365_members_user_idx on public.mission365_organization_members(user_id);
create index if not exists mission365_payouts_approved_by_idx on public.mission365_payouts(approved_by);
create index if not exists mission365_payouts_organization_idx on public.mission365_payouts(organization_id);
create index if not exists mission365_receipts_donor_idx on public.mission365_receipts(donor_user_id);
create index if not exists mission365_risk_donation_idx on public.mission365_risk_events(donation_id);
create index if not exists mission365_risk_mission_idx on public.mission365_risk_events(mission_id);
create index if not exists mission365_risk_organization_idx on public.mission365_risk_events(organization_id);
create index if not exists mission365_risk_resolved_by_idx on public.mission365_risk_events(resolved_by);
create index if not exists mission365_risk_user_idx on public.mission365_risk_events(user_id);
