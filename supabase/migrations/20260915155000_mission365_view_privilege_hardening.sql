-- MISSION 365 ONLY
-- The public mission intelligence surface is a VIEW, so it is not covered by
-- the base-table privilege hardening migration. Preserve SELECT while removing
-- table privileges that client roles do not need.

revoke truncate, references, trigger
on table public.mission365_public_mission_intelligence
from anon, authenticated;
