-- Mission 365 CRM control-plane privilege hardening.
--
-- The CRM link/outbox tables are internal coordination surfaces populated by
-- trusted triggers and future server-side workers. Browser roles do not need
-- direct table access. RLS remains enabled; this migration removes inherited
-- PostgreSQL privileges that could otherwise allow destructive operations such
-- as TRUNCATE outside row-policy semantics.

revoke all privileges on table public.mission365_crm_links from anon, authenticated;
revoke all privileges on table public.mission365_crm_outbox from anon, authenticated;

-- Keep the trusted backend role explicit for operational clarity.
grant all privileges on table public.mission365_crm_links to service_role;
grant all privileges on table public.mission365_crm_outbox to service_role;
