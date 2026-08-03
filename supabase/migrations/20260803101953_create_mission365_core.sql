create schema if not exists mission365_private;

create table public.mission365_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission365_organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  public_name text not null,
  organization_type text not null check (organization_type in ('nonprofit','community_project','school','faith_organization','business','individual_mission')),
  website_url text,
  verification_status text not null default 'pending' check (verification_status in ('pending','under_review','verified','rejected','suspended')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission365_organization_members (
  organization_id uuid not null references public.mission365_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('owner','manager','reporter','finance')),
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

create table public.mission365_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.mission365_organizations(id) on delete set null,
  application_type text not null check (application_type in ('mission_owner','business_partner')),
  legal_name text not null,
  public_name text not null,
  contact_email text not null,
  mission_summary text not null,
  requested_amount_cents bigint check (requested_amount_cents is null or requested_amount_cents > 0),
  status text not null default 'draft' check (status in ('draft','submitted','under_review','needs_information','approved','rejected','withdrawn')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission365_missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.mission365_organizations(id) on delete restrict,
  slug text not null unique,
  title text not null,
  summary text not null,
  story text not null,
  category text not null,
  city text,
  region text,
  country_code text not null default 'US',
  goal_amount_cents bigint not null check (goal_amount_cents > 0),
  funded_amount_cents bigint not null default 0 check (funded_amount_cents >= 0),
  status text not null default 'draft' check (status in ('draft','under_review','published','funded','reporting','completed','paused','rejected')),
  published_at timestamptz,
  funding_opens_at timestamptz,
  funding_closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);

create table public.mission365_milestones (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission365_missions(id) on delete cascade,
  title text not null,
  description text not null,
  target_date date,
  completed_at timestamptz,
  verification_status text not null default 'pending' check (verification_status in ('pending','submitted','verified','rejected')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.mission365_impact_updates (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission365_missions(id) on delete cascade,
  milestone_id uuid references public.mission365_milestones(id) on delete set null,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  body text not null,
  evidence_urls text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','submitted','published','rejected')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.mission365_giving_plans (
  id uuid primary key default gen_random_uuid(),
  donor_user_id uuid not null references auth.users(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  cadence text not null check (cadence in ('one_time','monthly')),
  status text not null default 'pending' check (status in ('pending','active','paused','cancelled','completed','payment_failed')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission365_donations (
  id uuid primary key default gen_random_uuid(),
  giving_plan_id uuid references public.mission365_giving_plans(id) on delete set null,
  donor_user_id uuid not null references auth.users(id) on delete restrict,
  mission_id uuid not null references public.mission365_missions(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  platform_fee_cents bigint not null default 0 check (platform_fee_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  status text not null check (status in ('pending','authorized','succeeded','failed','refunded','partially_refunded','disputed')),
  stripe_payment_intent_id text unique,
  idempotency_key uuid not null unique,
  receipt_url text,
  succeeded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mission365_profiles enable row level security;
alter table public.mission365_organizations enable row level security;
alter table public.mission365_organization_members enable row level security;
alter table public.mission365_applications enable row level security;
alter table public.mission365_missions enable row level security;
alter table public.mission365_milestones enable row level security;
alter table public.mission365_impact_updates enable row level security;
alter table public.mission365_giving_plans enable row level security;
alter table public.mission365_donations enable row level security;

create policy mission365_profiles_self_select on public.mission365_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy mission365_profiles_self_update on public.mission365_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy mission365_applications_owner_select on public.mission365_applications for select to authenticated using ((select auth.uid()) = applicant_user_id);
create policy mission365_applications_owner_insert on public.mission365_applications for insert to authenticated with check ((select auth.uid()) = applicant_user_id and status = 'draft');
create policy mission365_applications_owner_update on public.mission365_applications for update to authenticated using ((select auth.uid()) = applicant_user_id and status in ('draft','needs_information')) with check ((select auth.uid()) = applicant_user_id and status in ('draft','submitted','withdrawn'));
create policy mission365_published_organizations_public on public.mission365_organizations for select to anon,authenticated using (verification_status = 'verified');
create policy mission365_published_missions_public on public.mission365_missions for select to anon,authenticated using (status in ('published','funded','reporting','completed') and published_at is not null);
create policy mission365_published_milestones_public on public.mission365_milestones for select to anon,authenticated using (exists (select 1 from public.mission365_missions m where m.id = mission_id and m.status in ('published','funded','reporting','completed') and m.published_at is not null));
create policy mission365_published_updates_public on public.mission365_impact_updates for select to anon,authenticated using (status = 'published' and published_at is not null and exists (select 1 from public.mission365_missions m where m.id = mission_id and m.status in ('published','funded','reporting','completed')));
create policy mission365_giving_plans_owner_select on public.mission365_giving_plans for select to authenticated using ((select auth.uid()) = donor_user_id);
create policy mission365_donations_owner_select on public.mission365_donations for select to authenticated using ((select auth.uid()) = donor_user_id);

revoke all on table public.mission365_organization_members from anon,authenticated;
revoke insert,update,delete on table public.mission365_organizations from anon,authenticated;
revoke insert,update,delete on table public.mission365_missions from anon,authenticated;
revoke insert,update,delete on table public.mission365_milestones from anon,authenticated;
revoke insert,update,delete on table public.mission365_impact_updates from anon,authenticated;
revoke insert,update,delete on table public.mission365_giving_plans from anon,authenticated;
revoke insert,update,delete on table public.mission365_donations from anon,authenticated;

create index mission365_missions_public_idx on public.mission365_missions(status,published_at desc);
create index mission365_missions_category_idx on public.mission365_missions(category,status);
create index mission365_applications_owner_idx on public.mission365_applications(applicant_user_id,created_at desc);
create index mission365_donations_donor_idx on public.mission365_donations(donor_user_id,created_at desc);
create index mission365_donations_mission_idx on public.mission365_donations(mission_id,status);
