-- Visual reference assets: dormspaces featured neighborhoods + BahayGo featured locations.
-- Review with TJ before running in Supabase SQL Editor.

create table if not exists public.dormspace_featured_neighborhoods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  image_url text,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bahaygo_featured_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  image_url text,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dormspace_neighborhoods_active_order
  on public.dormspace_featured_neighborhoods (is_active, display_order);

create index if not exists idx_bahaygo_locations_active_order
  on public.bahaygo_featured_locations (is_active, display_order);

alter table public.dormspace_featured_neighborhoods enable row level security;
alter table public.bahaygo_featured_locations enable row level security;

drop policy if exists "Anyone can view active dormspace neighborhoods" on public.dormspace_featured_neighborhoods;
create policy "Anyone can view active dormspace neighborhoods"
  on public.dormspace_featured_neighborhoods
  for select
  using (is_active = true);

drop policy if exists "Admins can manage dormspace neighborhoods" on public.dormspace_featured_neighborhoods;
create policy "Admins can manage dormspace neighborhoods"
  on public.dormspace_featured_neighborhoods
  for all
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  );

drop policy if exists "Anyone can view active bahaygo locations" on public.bahaygo_featured_locations;
create policy "Anyone can view active bahaygo locations"
  on public.bahaygo_featured_locations
  for select
  using (is_active = true);

drop policy if exists "Admins can manage bahaygo locations" on public.bahaygo_featured_locations;
create policy "Admins can manage bahaygo locations"
  on public.bahaygo_featured_locations
  for all
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  );

comment on table public.dormspace_featured_neighborhoods is
  'Featured neighborhood cards on /dormspaces (Browse by area rows).';

comment on table public.bahaygo_featured_locations is
  'Featured location cards on BahayGo homepage.';

insert into public.dormspace_featured_neighborhoods (name, slug, city, image_url, display_order, is_active)
values
  (
    'BGC',
    'bgc',
    'Taguig',
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&h=600&q=80',
    10,
    true
  ),
  (
    'Makati CBD',
    'makati-cbd',
    'Makati',
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=800&h=600&q=80',
    20,
    true
  ),
  (
    'Ortigas Center',
    'ortigas-center',
    'Pasig',
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&h=600&q=80',
    30,
    true
  ),
  (
    'Manila',
    'manila',
    'Manila',
    'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&h=600&q=80',
    40,
    true
  ),
  (
    'Alabang',
    'alabang',
    'Muntinlupa',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&h=600&q=80',
    50,
    true
  ),
  (
    'Baguio',
    'baguio',
    'Baguio',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=800&h=600&q=80',
    60,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  city = excluded.city,
  image_url = excluded.image_url,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.bahaygo_featured_locations (name, slug, city, image_url, display_order, is_active)
values
  (
    'BGC',
    'bgc',
    'Taguig',
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&h=600&q=80',
    10,
    true
  ),
  (
    'Makati',
    'makati',
    'Makati',
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=800&h=600&q=80',
    20,
    true
  ),
  (
    'Ortigas',
    'ortigas',
    'Pasig',
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&h=600&q=80',
    30,
    true
  ),
  (
    'Cebu City',
    'cebu-city',
    'Cebu City',
    'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&h=600&q=80',
    40,
    true
  ),
  (
    'Davao',
    'davao',
    'Davao',
    'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?auto=format&fit=crop&w=800&h=600&q=80',
    50,
    true
  ),
  (
    'Tagaytay',
    'tagaytay',
    'Tagaytay',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=800&h=600&q=80',
    60,
    true
  ),
  (
    'Bacolod',
    'bacolod',
    'Bacolod',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&h=600&q=80',
    70,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  city = excluded.city,
  image_url = excluded.image_url,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();
