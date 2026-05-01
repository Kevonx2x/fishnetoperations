-- v1 duplicate detection: normalized location string only (lat/lng reserved for future Maps Tier 1).

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
  -- p_lat / p_lng are unused in v1; kept for a stable RPC signature.
  -- TODO: add lat/lng proximity check once Maps Tier 1 writes coordinates
  select
    p.id,
    coalesce(nullif(trim(p.name), ''), '')::text,
    p.location,
    p.listed_by
  from public.properties p
  where p.deleted_at is null
    and p.availability_state = 'available'
    and (p_exclude_id is null or p.id <> p_exclude_id)
    and lower(trim(p.location)) = lower(trim(coalesce(p_location, '')))
  limit 1;
$$;

comment on function public.find_duplicate_active_property is
  'First other active listing (deleted_at null, availability available) with same LOWER(TRIM(location)). Optional p_exclude_id for updates.';

revoke all on function public.find_duplicate_active_property(text, double precision, double precision, uuid) from public;
grant execute on function public.find_duplicate_active_property(text, double precision, double precision, uuid) to service_role;
grant execute on function public.find_duplicate_active_property(text, double precision, double precision, uuid) to authenticated;
