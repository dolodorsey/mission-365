create or replace function mission365_private.apply_donation_funding_delta()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  old_effective bigint := 0;
  new_effective bigint := 0;
  old_mission uuid := null;
  new_mission uuid := null;
  delta bigint := 0;
begin
  if tg_op = 'UPDATE' then
    old_mission := old.mission_id;
    if old.status in ('succeeded','partially_refunded') then
      old_effective := greatest(0, old.amount_cents - coalesce(old.refunded_amount_cents,0));
    end if;
  end if;

  new_mission := new.mission_id;
  if new.status in ('succeeded','partially_refunded') then
    new_effective := greatest(0, new.amount_cents - coalesce(new.refunded_amount_cents,0));
  end if;

  if tg_op = 'UPDATE' and old_mission is distinct from new_mission then
    if old_mission is not null and old_effective <> 0 then
      update public.mission365_missions
        set funded_amount_cents = greatest(0, funded_amount_cents - old_effective),
            updated_at = now()
        where id = old_mission;
    end if;
    if new_mission is not null and new_effective <> 0 then
      update public.mission365_missions
        set funded_amount_cents = greatest(0, funded_amount_cents + new_effective),
            updated_at = now()
        where id = new_mission;
    end if;
  else
    delta := new_effective - old_effective;
    if new_mission is not null and delta <> 0 then
      update public.mission365_missions
        set funded_amount_cents = greatest(0, funded_amount_cents + delta),
            updated_at = now()
        where id = new_mission;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists mission365_donation_funding_delta on public.mission365_donations;
create trigger mission365_donation_funding_delta
after insert or update of status, refunded_amount_cents, amount_cents, mission_id
on public.mission365_donations
for each row execute function mission365_private.apply_donation_funding_delta();

create or replace function mission365_private.apply_sponsorship_funding_delta()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  old_effective bigint := 0;
  new_effective bigint := 0;
  old_sid uuid := null;
  new_sid uuid := null;
  delta bigint := 0;
begin
  if tg_op = 'UPDATE' then
    old_sid := old.sponsorship_id;
    if old_sid is not null and old.status in ('succeeded','partially_refunded') then
      old_effective := greatest(0, old.amount_cents - coalesce(old.refunded_amount_cents,0));
    end if;
  end if;

  new_sid := new.sponsorship_id;
  if new_sid is not null and new.status in ('succeeded','partially_refunded') then
    new_effective := greatest(0, new.amount_cents - coalesce(new.refunded_amount_cents,0));
  end if;

  if tg_op = 'UPDATE' and old_sid is distinct from new_sid then
    if old_sid is not null and old_effective <> 0 then
      update public.mission365_business_sponsorships
      set funded_amount_cents = greatest(0, funded_amount_cents - old_effective),
          status = case
            when status = 'cancelled' then status
            when greatest(0, funded_amount_cents - old_effective) >= commitment_amount_cents then 'fulfilled'
            else 'active'
          end,
          updated_at = now()
      where id = old_sid;
    end if;

    if new_sid is not null and new_effective <> 0 then
      update public.mission365_business_sponsorships
      set funded_amount_cents = greatest(0, funded_amount_cents + new_effective),
          status = case
            when status = 'cancelled' then status
            when greatest(0, funded_amount_cents + new_effective) >= commitment_amount_cents then 'fulfilled'
            else 'active'
          end,
          updated_at = now()
      where id = new_sid;
    end if;
  else
    delta := new_effective - old_effective;
    if new_sid is not null and delta <> 0 then
      update public.mission365_business_sponsorships
      set funded_amount_cents = greatest(0, funded_amount_cents + delta),
          status = case
            when status = 'cancelled' then status
            when greatest(0, funded_amount_cents + delta) >= commitment_amount_cents then 'fulfilled'
            else 'active'
          end,
          updated_at = now()
      where id = new_sid;
    end if;
  end if;

  return new;
end;
$$;
