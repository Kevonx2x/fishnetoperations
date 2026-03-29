-- Properties listing (read by the public app via anon key)

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  location text not null,
  price text not null,
  sqft text not null,
  beds integer not null,
  baths integer not null,
  image_url text not null
);

comment on table public.properties is 'Real estate listings displayed on the marketing site';

alter table public.properties enable row level security;

create policy "properties_select_public"
  on public.properties
  for select
  to anon, authenticated
  using (true);

-- Seed rows (same content previously hardcoded in the app)
insert into public.properties (location, price, sqft, beds, baths, image_url) values
  (
    'Forbes Park',
    '₱52M+',
    '4,200',
    5,
    5,
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400&h=300&fit=crop'
  ),
  (
    'Dasmariñas Village',
    '₱150M+',
    '8,500',
    7,
    8,
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop'
  ),
  (
    'Alabang Hills',
    '₱68M+',
    '5,800',
    6,
    6,
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop'
  ),
  (
    'Ayala Alabang',
    '₱90M-',
    '6,200',
    6,
    7,
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop'
  );
