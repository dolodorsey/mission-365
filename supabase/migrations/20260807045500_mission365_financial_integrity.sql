create or replace function mission365_private.apply_donation_funding_delta()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  delta bigint := 0;
begin
  if tg_op = 'INSERT' then
    if new.status = 'succeeded' then delta := new.amount_cents; end if;
  elsif tg_op = 'UPDATE' then
    if old.status <> 'succeeded' and new.status = 'succeeded' then
      delta := new.amount_cents;
    elsif old.status = 'succeeded' and new.status in ('refunded','disputed') then
      delta := -old.amount_cents;
    end if;
  end if;

  if delta <> 0 then
    update public.mission365_missions
      set funded_amount_cents = greatest(0, funded_amount_cents + delta), updated_at = now()
      where id = new.mission_id;
  end if;
  return new;
end;
$$;

revoke all on function mission365_private.apply_donation_funding_delta() from public, anon, authenticated;

drop trigger if exists mission365_donation_funding_delta on public.mission365_donations;
create trigger mission365_donation_funding_delta
after insert or update of status on public.mission365_donations
for each row execute function mission365_private.apply_donation_funding_delta();

create or replace function mission365_private.available_mission_payout_cents(target_mission uuid)
returns bigint
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select greatest(
    0,
    coalesce((select sum(d.amount_cents - d.platform_fee_cents) from public.mission365_donations d where d.mission_id = target_mission and d.status = 'succeeded'),0)
    - coalesce((select sum(p.amount_cents) from public.mission365_payouts p where p.mission_id = target_mission and p.status in ('approved','processing','paid')),0)
  )::bigint;
$$;

revoke all on function mission365_private.available_mission_payout_cents(uuid) from public, anon, authenticated;

create unique index if not exists mission365_donation_payment_intent_unique_not_null on public.mission365_donations(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists mission365_giving_plan_subscription_idx on public.mission365_giving_plans(stripe_subscription_id) where stripe_subscription_id is not null;
