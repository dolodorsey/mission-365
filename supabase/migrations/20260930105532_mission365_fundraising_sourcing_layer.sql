-- MISSION 365 fundraising organizer + initiative sourcing layer
-- Production migration version: 20260930105532
-- Purpose: keep sourced fundraising prospects separate from verified Mission 365 organizations.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.mission365_fundraising_organizers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  organization_type text not null default 'nonprofit',
  website_url text,
  city text not null default 'Atlanta',
  state text not null default 'GA',
  market text not null default 'Metro Atlanta',
  submarket text,
  cause_categories text[] not null default '{}',
  season_focus text[] not null default '{}',
  recurrence_profile text not null default 'annual'
    check (recurrence_profile in ('annual','seasonal','year_round','mixed','unknown')),
  year_round_fundraising boolean not null default false,
  public_contact_email text,
  public_contact_phone text,
  contact_page_url text,
  source_confidence integer not null default 0 check (source_confidence between 0 and 100),
  mission365_fit_score integer not null default 0 check (mission365_fit_score between 0 and 100),
  priority_tier text not null default 'C' check (priority_tier in ('A','B','C','D')),
  outreach_status text not null default 'not_contacted'
    check (outreach_status in ('not_contacted','queued','contacted','replied','meeting','application_started','nurture','do_not_contact','disqualified')),
  verification_status text not null default 'sourced_unverified'
    check (verification_status in ('sourced_unverified','source_reviewed','contact_verified','invited','applied','under_review','converted_to_verified_org','rejected')),
  owner_name text not null default 'Jojo',
  partner_owner_name text not null default 'Q',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.mission365_fundraising_initiatives (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references private.mission365_fundraising_organizers(id) on delete cascade,
  name text not null,
  initiative_type text not null default 'fundraiser'
    check (initiative_type in ('gala','luncheon','run_walk','toy_drive','food_drive','coat_drive','holiday_campaign','auction','golf','community_event','sponsorship_campaign','peer_to_peer','fundraiser','other')),
  event_start_date date,
  event_end_date date,
  season text not null default 'fall_winter_2026_27',
  recurrence text not null default 'annual'
    check (recurrence in ('annual','seasonal','year_round','recurring','one_time','unknown')),
  fundraising_status text not null default 'upcoming'
    check (fundraising_status in ('active','upcoming','recent','evergreen','needs_verification','completed')),
  fundraising_mechanisms text[] not null default '{}',
  sponsor_opportunity boolean not null default false,
  volunteer_opportunity boolean not null default false,
  donation_opportunity boolean not null default true,
  published_goal_usd numeric(14,2),
  target_beneficiaries text,
  city text not null default 'Atlanta',
  state text not null default 'GA',
  venue text,
  source_url text,
  source_title text,
  source_quality text not null default 'secondary_current'
    check (source_quality in ('official_current','official_evergreen','secondary_current','secondary','needs_review')),
  source_checked_at timestamptz not null default now(),
  evidence_summary text,
  qualification_reason text,
  fit_score integer not null default 0 check (fit_score between 0 and 100),
  priority_tier text not null default 'C' check (priority_tier in ('A','B','C','D')),
  outreach_status text not null default 'not_contacted'
    check (outreach_status in ('not_contacted','queued','contacted','replied','meeting','application_started','nurture','do_not_contact','disqualified')),
  next_action text,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizer_id, name, event_start_date)
);

create table if not exists private.mission365_fundraising_sources (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references private.mission365_fundraising_initiatives(id) on delete cascade,
  source_url text not null,
  source_title text,
  source_kind text not null default 'event_page'
    check (source_kind in ('event_page','organization_page','news','calendar','contact_page','donation_page','sponsorship_page','other')),
  source_quality text not null default 'secondary'
    check (source_quality in ('official_current','official_evergreen','secondary_current','secondary','needs_review')),
  observed_at timestamptz not null default now(),
  evidence text,
  is_primary boolean not null default false,
  unique (initiative_id, source_url)
);

create index if not exists mission365_fundraising_organizers_priority_idx
  on private.mission365_fundraising_organizers (priority_tier, mission365_fit_score desc);

create index if not exists mission365_fundraising_organizers_outreach_idx
  on private.mission365_fundraising_organizers (outreach_status, verification_status);

create index if not exists mission365_fundraising_initiatives_dates_idx
  on private.mission365_fundraising_initiatives (event_start_date, fundraising_status);

create index if not exists mission365_fundraising_initiatives_priority_idx
  on private.mission365_fundraising_initiatives (priority_tier, fit_score desc);

create index if not exists mission365_fundraising_sources_initiative_idx
  on private.mission365_fundraising_sources (initiative_id, is_primary desc);
