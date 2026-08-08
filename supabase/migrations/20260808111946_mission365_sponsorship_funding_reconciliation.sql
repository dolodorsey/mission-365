create or replace function mission365_private.apply_sponsorship_funding_delta()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $$
declare old_effective bigint := 0;new_effective bigint := 0;delta bigint := 0;sid uuid;
begin
 sid:=coalesce(new.sponsorship_id,old.sponsorship_id);if sid is null then return new;end if;
 if tg_op='UPDATE' and old.sponsorship_id is not null and old.status in ('succeeded','partially_refunded') then old_effective:=greatest(0,old.amount_cents-coalesce(old.refunded_amount_cents,0));end if;
 if new.sponsorship_id is not null and new.status in ('succeeded','partially_refunded') then new_effective:=greatest(0,new.amount_cents-coalesce(new.refunded_amount_cents,0));end if;
 delta:=new_effective-old_effective;
 if delta<>0 then update public.mission365_business_sponsorships set funded_amount_cents=greatest(0,funded_amount_cents+delta),status=case when status='cancelled' then status when greatest(0,funded_amount_cents+delta)>=commitment_amount_cents then 'fulfilled' else 'active' end,updated_at=now() where id=sid;end if;
 return new;
end;$$;
drop trigger if exists mission365_donation_sponsorship_delta on public.mission365_donations;
create trigger mission365_donation_sponsorship_delta after insert or update of status,refunded_amount_cents,sponsorship_id,amount_cents on public.mission365_donations for each row execute function mission365_private.apply_sponsorship_funding_delta();
