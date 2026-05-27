-- Universities near Metro Manila dorm markets (map + discovery row + walk-time destinations).
-- Review with TJ before running in Supabase SQL Editor.

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  full_name text,
  city text not null,
  neighborhood text,
  latitude double precision not null,
  longitude double precision not null,
  image_url text,
  listing_count integer not null default 0,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_universities_active_order
  on public.universities (is_active, display_order);

alter table public.universities enable row level security;

drop policy if exists "Anyone can view active universities" on public.universities;
create policy "Anyone can view active universities"
  on public.universities
  for select
  using (is_active = true);

drop policy if exists "Admins can manage universities" on public.universities;
create policy "Admins can manage universities"
  on public.universities
  for all
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  );

comment on table public.universities is
  'Major universities for dorm discovery, map pins, and walking-distance calculations.';

-- Stable ids for walk-time seeds and ?university= query params.
insert into public.universities (
  id,
  name,
  short_name,
  full_name,
  city,
  neighborhood,
  latitude,
  longitude,
  image_url,
  listing_count,
  display_order,
  is_active
)
values
  (
    'a8000000-0000-0000-0000-000000000001',
    'DLSU Manila',
    'DLSU',
    'De La Salle University',
    'Manila',
    'Malate',
    14.564611,
    120.993019,
    'https://images.unsplash.com/photo-1562774053-701939374585?w=400&h=400&fit=crop',
    0,
    10,
    true
  ),
  (
    'a8000000-0000-0000-0000-000000000002',
    'Benilde',
    'Benilde',
    'De La Salle-College of Saint Benilde',
    'Manila',
    'Malate',
    14.563047,
    120.994667,
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=400&fit=crop',
    0,
    20,
    true
  ),
  (
    'a8000000-0000-0000-0000-000000000003',
    'UST',
    'UST',
    'University of Santo Tomas',
    'Manila',
    'Sampaloc',
    14.609719,
    120.989324,
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400&h=400&fit=crop',
    0,
    30,
    true
  ),
  (
    'a8000000-0000-0000-0000-000000000004',
    'PUP',
    'PUP',
    'Polytechnic University of the Philippines',
    'Manila',
    'Sta. Mesa',
    14.596351,
    121.004997,
    'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=400&h=400&fit=crop',
    0,
    40,
    true
  ),
  (
    'a8000000-0000-0000-0000-000000000005',
    'Mapúa University',
    'Mapúa',
    'Mapúa University',
    'Manila',
    'Intramuros',
    14.590729,
    120.979912,
    'https://images.unsplash.com/photo-1607237138185-eedd9c632b59?w=400&h=400&fit=crop',
    0,
    50,
    true
  ),
  (
    'a8000000-0000-0000-0000-000000000006',
    'FEU',
    'FEU',
    'Far Eastern University',
    'Manila',
    'Sampaloc',
    14.603564,
    120.991409,
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=400&fit=crop',
    0,
    60,
    true
  ),
  (
    'a8000000-0000-0000-0000-000000000007',
    'Ateneo',
    'Ateneo',
    'Ateneo de Manila University',
    'Quezon City',
    'Loyola Heights',
    14.639492,
    121.077841,
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=400&fit=crop',
    0,
    70,
    true
  ),
  (
    'a8000000-0000-0000-0000-000000000008',
    'UP Diliman',
    'UP Diliman',
    'University of the Philippines Diliman',
    'Quezon City',
    'Diliman',
    14.653945,
    121.068366,
    'https://images.unsplash.com/photo-1562774053-701939374585?w=400&h=400&fit=crop',
    0,
    80,
    true
  ),
  (
    'a8000000-0000-0000-0000-000000000009',
    'DLSU-D',
    'DLSU-D',
    'De La Salle University-Dasmariñas',
    'Dasmariñas',
    'Dasmariñas',
    14.329444,
    120.936389,
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=400&fit=crop',
    0,
    90,
    true
  ),
  (
    'a8000000-0000-0000-0000-000000000010',
    'Adamson University',
    'Adamson',
    'Adamson University',
    'Manila',
    'Ermita',
    14.587444,
    120.993861,
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=400&fit=crop',
    0,
    100,
    true
  )
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  full_name = excluded.full_name,
  city = excluded.city,
  neighborhood = excluded.neighborhood,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  image_url = excluded.image_url,
  display_order = excluded.display_order,
  is_active = excluded.is_active;
