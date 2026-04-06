alter table public.agents
  add column if not exists availability_schedule jsonb not null default '{}'::jsonb;

comment on column public.agents.availability_schedule is 'Weekly hours: { monday: { enabled, start, end }, ... }';
