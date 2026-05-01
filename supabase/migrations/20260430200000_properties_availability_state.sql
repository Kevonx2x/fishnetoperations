-- Listing availability for marketplace vs reserved/closed/removed flows.

alter table public.properties
  add column if not exists availability_state text not null default 'available';

update public.properties
set availability_state = 'removed'
where deleted_at is not null
  and availability_state = 'available';

alter table public.properties drop constraint if exists properties_availability_state_check;

alter table public.properties
  add constraint properties_availability_state_check
  check (availability_state in ('available', 'reserved', 'closed', 'removed'));

comment on column public.properties.availability_state is
  'Public discovery: only available shows on homepage/search. reserved|closed|removed still visible to listing owner and client saved/pipeline with grayed UI.';

create index if not exists idx_properties_availability_state on public.properties (availability_state);

-- Duplicate detection for publish (v1): same normalized address or lat/lng within ~10m.
create or replace function public.find_duplicate_active_property(
  p_location text,
  p_lat double precision,
  p_lng double precision,
  p_exclude_id uuid default null
)
returns table (
  id uuid,
  prop_name text,
  prop_location text,
  listed_by uuid
)
language sql
stable
as $$
  select p.id, coalesce(nullif(trim(p.name), ''), ''), p.location, p.listed_by
  from public.properties p
  where p.deleted_at is null
    and p.availability_state = 'available'
    and (p_exclude_id is null or p.id <> p_exclude_id)
    and (
      lower(trim(p.location)) = lower(trim(coalesce(p_location, '')))
      or (
        p.lat is not null
        and p.lng is not null
        and p_lat is not null
        and p_lng is not null
        and abs(p.lat - p_lat) <= 0.0001
        and abs(p.lng - p_lng) <= 0.0001
      )
    )
  limit 1;
$$;

comment on function public.find_duplicate_active_property is
  'Returns first other listing that is publicly active (not soft-deleted, availability available) with same trimmed address (case-insensitive) or matching lat/lng within 0.0001 degrees.';

revoke all on function public.find_duplicate_active_property(text, double precision, double precision, uuid) from public;
grant execute on function public.find_duplicate_active_property(text, double precision, double precision, uuid) to service_role;
