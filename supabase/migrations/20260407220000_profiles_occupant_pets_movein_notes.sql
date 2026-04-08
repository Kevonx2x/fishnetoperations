-- Client profile: household & agent-facing notes (viewing request prefill)

alter table public.profiles add column if not exists occupant_count integer default 1;
alter table public.profiles add column if not exists has_pets boolean default false;
alter table public.profiles add column if not exists move_in_timeline text;
alter table public.profiles add column if not exists agent_notes text;

comment on column public.profiles.occupant_count is 'Expected occupants (1–20)';
comment on column public.profiles.has_pets is 'Whether the client has pets';
comment on column public.profiles.move_in_timeline is 'Preferred move-in window label';
comment on column public.profiles.agent_notes is 'Free-form notes for agents (max ~300 chars in UI)';

alter table public.profiles drop constraint if exists profiles_occupant_count_check;
alter table public.profiles
  add constraint profiles_occupant_count_check
  check (occupant_count is null or (occupant_count >= 1 and occupant_count <= 20));
