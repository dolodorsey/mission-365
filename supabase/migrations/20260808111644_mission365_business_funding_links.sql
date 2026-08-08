alter table public.mission365_donations add column if not exists business_organization_id uuid references public.mission365_organizations(id) on delete set null;
alter table public.mission365_donations add column if not exists sponsorship_id uuid references public.mission365_business_sponsorships(id) on delete set null;
create index if not exists mission365_donations_business_idx on public.mission365_donations(business_organization_id,created_at desc);
create index if not exists mission365_donations_sponsorship_idx on public.mission365_donations(sponsorship_id,created_at desc);
