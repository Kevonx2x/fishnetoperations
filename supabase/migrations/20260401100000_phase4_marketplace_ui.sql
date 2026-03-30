-- Phase 4: profile settings, property taxonomy & map coords, public read for listings agents

-- ---------------------------------------------------------------------------
-- Profiles: contact + notification preferences
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists notify_email boolean not null default true;

comment on column public.profiles.notify_email is 'User preference: marketing/activity email notifications';

-- ---------------------------------------------------------------------------
-- Properties: type + map position (nullable until geocoded)
-- ---------------------------------------------------------------------------
alter table public.properties add column if not exists property_type text;
alter table public.properties add column if not exists lat double precision;
alter table public.properties add column if not exists lng double precision;

create index if not exists properties_property_type_idx on public.properties (property_type);

comment on column public.properties.property_type is 'House, Condo, Villa, Townhouse, Land, etc.';
comment on column public.properties.lat is 'Latitude for map marker (WGS84)';
comment on column public.properties.lng is 'Longitude for map marker (WGS84)';

-- Rough coordinates for seeded luxury areas (Metro Manila)
update public.properties
set
  lat = case
    when location ilike '%Forbes%' then 14.5548
    when location ilike '%Dasmari%' then 14.5612
    when location ilike '%Alabang%' and location not ilike '%Ayala%' then 14.4115
    when location ilike '%Ayala Alabang%' then 14.4190
    else coalesce(lat, 14.52)
  end,
  lng = case
    when location ilike '%Forbes%' then 121.0528
    when location ilike '%Dasmari%' then 121.0320
    when location ilike '%Alabang%' and location not ilike '%Ayala%' then 121.0320
    when location ilike '%Ayala Alabang%' then 121.0290
    else coalesce(lng, 121.05)
  end,
  property_type = coalesce(
    property_type,
    case
      when location ilike '%condo%' or location ilike '%tower%' or location ilike '%rockwell%' then 'Condo'
      when location ilike '%villa%' or location ilike '%village%' or location ilike '%hills%' then 'Villa'
      when location ilike '%townhouse%' or location ilike '%town%' then 'Townhouse'
      else 'House'
    end
  )
where lat is null or lng is null or property_type is null;

-- ---------------------------------------------------------------------------
-- RLS: minimal public profile read for anyone who lists a property
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_if_listing_agent" on public.profiles;
create policy "profiles_select_if_listing_agent"
  on public.profiles for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.properties pr
      where pr.listed_by = profiles.id
    )
  );

-- Public directory: approved agents (anon homepage)
drop policy if exists "agents_select_public_approved" on public.agents;
create policy "agents_select_public_approved"
  on public.agents for select
  to anon, authenticated
  using (status = 'approved' and verified = true);
