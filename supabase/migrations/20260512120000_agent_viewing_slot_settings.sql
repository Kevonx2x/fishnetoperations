-- Agent viewing calendar defaults (Phase 1 slot reservation settings).
alter table public.agents add column if not exists viewing_slot_minutes int default 45;
alter table public.agents add column if not exists viewing_buffer_minutes int default 60;
alter table public.agents add column if not exists viewing_day_start_hour int default 9;
alter table public.agents add column if not exists viewing_day_end_hour int default 19;

comment on column public.agents.viewing_slot_minutes is 'Length of each viewing appointment in minutes (30/45/60/90).';
comment on column public.agents.viewing_buffer_minutes is 'Buffer after each viewing for travel/prep (0/30/60/120).';
comment on column public.agents.viewing_day_start_hour is 'Earliest viewing start hour (0–23) in agent local context (app uses Asia/Manila).';
comment on column public.agents.viewing_day_end_hour is 'Latest viewing start hour (0–23, exclusive upper bound in Manila hour check).';
