-- Ensure public volunteer discovery and direct client registration never expose
-- or target opportunities belonging to unpublished Mission 365 profiles.

drop policy if exists mission365_volunteer_opportunities_public_read
on public.mission365_volunteer_opportunities;

create policy mission365_volunteer_opportunities_public_read
on public.mission365_volunteer_opportunities
for select
to anon, authenticated
using (
  status = any (array['open'::text, 'filled'::text, 'closed'::text])
  and exists (
    select 1
    from public.mission365_mission_profiles p
    where p.id = mission365_volunteer_opportunities.profile_id
      and p.is_public
      and p.published_at is not null
  )
);

drop policy if exists mission365_volunteer_signups_own
on public.mission365_volunteer_signups;

create policy mission365_volunteer_signups_owner_select
on public.mission365_volunteer_signups
for select
to authenticated
using (user_id = (select auth.uid()));

create policy mission365_volunteer_signups_owner_insert
on public.mission365_volunteer_signups
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.mission365_volunteer_opportunities o
    join public.mission365_mission_profiles p on p.id = o.profile_id
    where o.id = mission365_volunteer_signups.opportunity_id
      and o.status = 'open'
      and p.is_public
      and p.published_at is not null
  )
);

create policy mission365_volunteer_signups_owner_update
on public.mission365_volunteer_signups
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy mission365_volunteer_signups_owner_delete
on public.mission365_volunteer_signups
for delete
to authenticated
using (user_id = (select auth.uid()));
