alter table public.mission365_risk_events drop constraint if exists mission365_risk_events_status_check;
alter table public.mission365_risk_events add constraint mission365_risk_events_status_check check (status in ('open','investigating','cleared','actioned','resolved'));
