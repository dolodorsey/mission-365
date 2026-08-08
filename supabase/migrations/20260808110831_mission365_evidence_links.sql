alter table public.mission365_documents add column if not exists mission_id uuid references public.mission365_missions(id) on delete cascade;
alter table public.mission365_documents add column if not exists milestone_id uuid references public.mission365_milestones(id) on delete set null;
alter table public.mission365_documents add column if not exists impact_update_id uuid references public.mission365_impact_updates(id) on delete set null;
create index if not exists mission365_documents_mission_idx on public.mission365_documents(mission_id,created_at desc);
create index if not exists mission365_documents_milestone_idx on public.mission365_documents(milestone_id,created_at desc);
create index if not exists mission365_documents_impact_idx on public.mission365_documents(impact_update_id,created_at desc);
