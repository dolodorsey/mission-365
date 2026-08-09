-- Mission 365 P0 perf: cover the saved_missions -> missions foreign key.
create index if not exists mission365_saved_missions_mission_id_idx
  on public.mission365_saved_missions (mission_id);
