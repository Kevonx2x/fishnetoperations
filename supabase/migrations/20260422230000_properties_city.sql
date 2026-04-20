-- Canonical city for Featured Locations / filters; full free-text address stays in `location`.

alter table public.properties add column if not exists city text;

comment on column public.properties.city is 'Normalized city/area label for grouping (see lib/normalize-city.ts). Full address remains in location.';

create index if not exists idx_properties_city on public.properties (city);
