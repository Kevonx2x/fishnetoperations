-- Phase 1 Batch 3: optional listing ownership for agent/broker dashboards

alter table public.properties
  add column if not exists listed_by uuid references public.profiles (id) on delete set null;

create index if not exists properties_listed_by_idx on public.properties (listed_by);

comment on column public.properties.listed_by is 'Agent (or staff profile) who lists the property; used for dashboards';
