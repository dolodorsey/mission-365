grant usage on schema public to anon, authenticated;

grant select on table public.mission365_organizations to anon, authenticated;
grant select on table public.mission365_missions to anon, authenticated;
grant select on table public.mission365_milestones to anon, authenticated;
grant select on table public.mission365_impact_updates to anon, authenticated;

grant select, update on table public.mission365_profiles to authenticated;
grant select, insert, update on table public.mission365_applications to authenticated;
grant select on table public.mission365_giving_plans to authenticated;
grant select on table public.mission365_donations to authenticated;
grant select on table public.mission365_payout_accounts to authenticated;
grant select on table public.mission365_payouts to authenticated;
grant select on table public.mission365_business_sponsorships to authenticated;
grant select on table public.mission365_receipts to authenticated;
grant select on table public.mission365_documents to authenticated;
grant select, update on table public.mission365_notifications to authenticated;

revoke all on table public.mission365_organization_members from anon, authenticated;
revoke all on table public.mission365_stripe_events from anon, authenticated;
revoke all on table public.mission365_risk_events from anon, authenticated;
revoke all on table public.mission365_audit_log from anon, authenticated;
