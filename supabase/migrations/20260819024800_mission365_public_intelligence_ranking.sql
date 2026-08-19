create or replace view public.mission365_public_mission_intelligence as
with impact as (
  select mission_id,
         count(*) filter (where status in ('approved','published')) as verified_impact_count,
         count(*) filter (where status in ('approved','published') and coalesce(array_length(evidence_urls,1),0)>0) as evidenced_impact_count
  from public.mission365_impact_updates group by mission_id
), testimonials as (
  select profile_id,
         count(*) filter (where status in ('approved','published') and verification_status in ('verified','approved')) as verified_testimonial_count
  from public.mission365_mission_testimonials group by profile_id
), volunteers as (
  select profile_id,
         count(*) filter (where status='open' and (ends_at is null or ends_at>=now())) as open_opportunity_count
  from public.mission365_volunteer_opportunities group by profile_id
), registry as (
  select mission_id,
         count(*) filter (where status in ('open','active','funding')) as active_registry_count
  from public.mission365_registry_items group by mission_id
)
select p.*,
       coalesce(i.verified_impact_count,0) as verified_impact_count,
       coalesce(i.evidenced_impact_count,0) as evidenced_impact_count,
       coalesce(t.verified_testimonial_count,0) as verified_testimonial_count,
       coalesce(v.open_opportunity_count,0) as open_opportunity_count,
       coalesce(r.active_registry_count,0) as active_registry_count,
       least(100,
         (case when p.source_status='sourced' then 30 else 0 end) +
         least(30, coalesce(i.evidenced_impact_count,0)*15 + coalesce(i.verified_impact_count,0)*5) +
         least(15, coalesce(t.verified_testimonial_count,0)*5) +
         least(15, coalesce(v.open_opportunity_count,0)*5 + coalesce(r.active_registry_count,0)*3) +
         (case when p.updated_at>=now()-interval '30 days' then 10 when p.updated_at>=now()-interval '90 days' then 5 else 0 end)
       )::integer as intelligence_score
from public.mission365_mission_profiles p
left join impact i on i.mission_id=p.mission_id
left join testimonials t on t.profile_id=p.id
left join volunteers v on v.profile_id=p.id
left join registry r on r.mission_id=p.mission_id;

grant select on public.mission365_public_mission_intelligence to anon, authenticated;
comment on view public.mission365_public_mission_intelligence is 'Public Mission 365 profiles ranked by source legitimacy, verified/evidenced impact, verified testimonials, live opportunities, and freshness. Publication recency is not a quality score.';
