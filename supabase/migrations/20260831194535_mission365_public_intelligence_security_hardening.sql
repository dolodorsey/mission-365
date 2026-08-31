-- Mission 365 public intelligence hardening
--
-- Fixes two institutional-scale issues in the public mission intelligence view:
-- 1) the view was SECURITY DEFINER while directly readable by anon/authenticated roles;
-- 2) several scoring predicates referenced retired status values, degrading intelligence quality.
--
-- The view remains intentionally public, but now executes with the caller's RLS context
-- and adds an explicit public/published profile filter as defense in depth.

create or replace view public.mission365_public_mission_intelligence
with (security_invoker = true)
as
with impact as (
  select
    mission_id,
    count(*) filter (
      where status = 'published'
        and published_at is not null
    ) as verified_impact_count,
    count(*) filter (
      where status = 'published'
        and published_at is not null
        and coalesce(array_length(evidence_urls, 1), 0) > 0
    ) as evidenced_impact_count
  from public.mission365_impact_updates
  group by mission_id
), testimonials as (
  select
    profile_id,
    count(*) filter (
      where status = 'published'
        and verification_status = 'verified'
    ) as verified_testimonial_count
  from public.mission365_mission_testimonials
  group by profile_id
), volunteers as (
  select
    profile_id,
    count(*) filter (
      where status = 'open'
        and (ends_at is null or ends_at >= now())
    ) as open_opportunity_count
  from public.mission365_volunteer_opportunities
  group by profile_id
), registry as (
  select
    mission_id,
    count(*) filter (
      where status in ('open', 'partially_funded')
    ) as active_registry_count
  from public.mission365_registry_items
  group by mission_id
)
select
  p.id,
  p.mission_id,
  p.slug,
  p.title,
  p.summary,
  p.story,
  p.category,
  p.city,
  p.region,
  p.lifecycle_status,
  p.fundraising_status,
  p.cover_media_url,
  p.logo_url,
  p.source_status,
  p.is_public,
  p.published_at,
  p.created_at,
  p.updated_at,
  coalesce(i.verified_impact_count, 0::bigint) as verified_impact_count,
  coalesce(i.evidenced_impact_count, 0::bigint) as evidenced_impact_count,
  coalesce(t.verified_testimonial_count, 0::bigint) as verified_testimonial_count,
  coalesce(v.open_opportunity_count, 0::bigint) as open_opportunity_count,
  coalesce(r.active_registry_count, 0::bigint) as active_registry_count,
  least(
    100::bigint,
    (case
      when p.source_status = 'verified' then 30
      when p.source_status = 'sourced' then 20
      else 0
    end)::bigint
    + least(
        30::bigint,
        coalesce(i.evidenced_impact_count, 0::bigint) * 15
        + coalesce(i.verified_impact_count, 0::bigint) * 5
      )
    + least(
        15::bigint,
        coalesce(t.verified_testimonial_count, 0::bigint) * 5
      )
    + least(
        15::bigint,
        coalesce(v.open_opportunity_count, 0::bigint) * 5
        + coalesce(r.active_registry_count, 0::bigint) * 3
      )
    + (case
        when p.updated_at >= now() - interval '30 days' then 10
        when p.updated_at >= now() - interval '90 days' then 5
        else 0
      end)::bigint
  )::integer as intelligence_score
from public.mission365_mission_profiles p
left join impact i on i.mission_id = p.mission_id
left join testimonials t on t.profile_id = p.id
left join volunteers v on v.profile_id = p.id
left join registry r on r.mission_id = p.mission_id
where p.is_public
  and p.published_at is not null;

comment on view public.mission365_public_mission_intelligence is
  'Public Mission 365 intelligence rollup. SECURITY INVOKER; only public/published profiles are eligible, and referenced tables remain governed by their own RLS policies.';

grant select on public.mission365_public_mission_intelligence to anon, authenticated, service_role;
