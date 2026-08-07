alter table public.mission365_giving_plans add column if not exists mission_id uuid references public.mission365_missions(id) on delete restrict;
alter table public.mission365_giving_plans add column if not exists stripe_checkout_session_id text unique;
alter table public.mission365_donations add column if not exists stripe_checkout_session_id text unique;
alter table public.mission365_donations add column if not exists stripe_charge_id text;

create table if not exists public.mission365_payout_accounts (
  organization_id uuid primary key references public.mission365_organizations(id) on delete cascade,
  stripe_account_id text not null unique,
  onboarding_status text not null default 'not_started' check (onboarding_status in ('not_started','in_progress','restricted','ready','disabled')),
  transfers_status text not null default 'inactive' check (transfers_status in ('inactive','pending','active','restricted')),
  requirements_due jsonb not null default '[]'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission365_payouts (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission365_missions(id) on delete restrict,
  organization_id uuid not null references public.mission365_organizations(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  platform_fee_cents bigint not null default 0 check (platform_fee_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  status text not null default 'pending_review' check (status in ('pending_review','approved','processing','paid','failed','reversed','cancelled')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  stripe_transfer_id text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission365_business_sponsorships (
  id uuid primary key default gen_random_uuid(),
  business_organization_id uuid not null references public.mission365_organizations(id) on delete restrict,
  mission_id uuid not null references public.mission365_missions(id) on delete restrict,
  commitment_amount_cents bigint not null check (commitment_amount_cents > 0),
  funded_amount_cents bigint not null default 0 check (funded_amount_cents >= 0),
  sponsorship_type text not null check (sponsorship_type in ('direct','matched_giving','employee_giving','campaign')),
  status text not null default 'draft' check (status in ('draft','active','fulfilled','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission365_stripe_events (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null default false,
  payload jsonb not null,
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.mission365_receipts (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null unique references public.mission365_donations(id) on delete cascade,
  donor_user_id uuid not null references auth.users(id) on delete restrict,
  receipt_number text not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd',
  issued_at timestamptz not null default now(),
  receipt_url text
);

create table if not exists public.mission365_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.mission365_applications(id) on delete cascade,
  organization_id uuid references public.mission365_organizations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  document_type text not null,
  storage_bucket text not null default 'mission365-private',
  storage_path text not null,
  review_status text not null default 'pending' check (review_status in ('pending','accepted','rejected','expired')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (application_id is not null or organization_id is not null)
);

create table if not exists public.mission365_risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.mission365_organizations(id) on delete set null,
  donation_id uuid references public.mission365_donations(id) on delete set null,
  mission_id uuid references public.mission365_missions(id) on delete set null,
  risk_type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','investigating','cleared','actioned')),
  details jsonb not null default '{}'::jsonb,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mission365_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mission365_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mission365_payout_accounts enable row level security;
alter table public.mission365_payouts enable row level security;
alter table public.mission365_business_sponsorships enable row level security;
alter table public.mission365_stripe_events enable row level security;
alter table public.mission365_receipts enable row level security;
alter table public.mission365_documents enable row level security;
alter table public.mission365_risk_events enable row level security;
alter table public.mission365_notifications enable row level security;
alter table public.mission365_audit_log enable row level security;

create policy mission365_payout_accounts_members_read on public.mission365_payout_accounts for select to authenticated using (exists (select 1 from public.mission365_organization_members m where m.organization_id = mission365_payout_accounts.organization_id and m.user_id = (select auth.uid())));
create policy mission365_payouts_members_read on public.mission365_payouts for select to authenticated using (exists (select 1 from public.mission365_organization_members m where m.organization_id = mission365_payouts.organization_id and m.user_id = (select auth.uid())));
create policy mission365_sponsorships_business_read on public.mission365_business_sponsorships for select to authenticated using (exists (select 1 from public.mission365_organization_members m where m.organization_id = business_organization_id and m.user_id = (select auth.uid())));
create policy mission365_receipts_owner_read on public.mission365_receipts for select to authenticated using (donor_user_id = (select auth.uid()));
create policy mission365_documents_uploader_read on public.mission365_documents for select to authenticated using (uploaded_by = (select auth.uid()));
create policy mission365_notifications_owner_select on public.mission365_notifications for select to authenticated using (user_id = (select auth.uid()));
create policy mission365_notifications_owner_update on public.mission365_notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.mission365_stripe_events from anon,authenticated;
revoke all on table public.mission365_risk_events from anon,authenticated;
revoke all on table public.mission365_audit_log from anon,authenticated;
revoke insert,update,delete on table public.mission365_payout_accounts from anon,authenticated;
revoke insert,update,delete on table public.mission365_payouts from anon,authenticated;
revoke insert,update,delete on table public.mission365_business_sponsorships from anon,authenticated;
revoke insert,update,delete on table public.mission365_receipts from anon,authenticated;
revoke insert,update,delete on table public.mission365_documents from anon,authenticated;
revoke insert,delete on table public.mission365_notifications from anon,authenticated;

create index if not exists mission365_payouts_mission_status_idx on public.mission365_payouts(mission_id,status,created_at desc);
create index if not exists mission365_sponsorships_mission_idx on public.mission365_business_sponsorships(mission_id,status);
create index if not exists mission365_risk_status_idx on public.mission365_risk_events(status,severity,created_at desc);
create index if not exists mission365_notifications_user_idx on public.mission365_notifications(user_id,created_at desc);
create index if not exists mission365_audit_entity_idx on public.mission365_audit_log(entity_type,entity_id,created_at desc);
