-- Fishnet Residences: property/agent graph + luxury seed data
-- - Adds property name + status
-- - Adds property_photos (room carousel)
-- - Adds property_agents junction (connected agents)
-- - Seeds 10 properties + 10 agents + connections

-- ---------------------------------------------------------------------------
-- Properties: name + status
-- ---------------------------------------------------------------------------
alter table public.properties
  add column if not exists name text;

alter table public.properties
  add column if not exists status text not null default 'for_sale';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_status_check') then
    alter table public.properties
      add constraint properties_status_check check (status in ('for_sale', 'for_rent'));
  end if;
exception when others then
  null;
end $$;

comment on column public.properties.name is 'Marketing name (e.g., Forbes Park Villa)';
comment on column public.properties.status is 'for_sale | for_rent (public listing state)';

-- ---------------------------------------------------------------------------
-- Room photos per property (4 per listing)
-- ---------------------------------------------------------------------------
create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists property_photos_property_id_idx on public.property_photos (property_id, sort_order);

alter table public.property_photos enable row level security;

drop policy if exists "property_photos_select_public" on public.property_photos;
create policy "property_photos_select_public"
  on public.property_photos for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Connected agents per property (junction)
-- ---------------------------------------------------------------------------
create table if not exists public.property_agents (
  property_id uuid not null references public.properties (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (property_id, agent_id)
);

create index if not exists property_agents_property_id_idx on public.property_agents (property_id);
create index if not exists property_agents_agent_id_idx on public.property_agents (agent_id);

alter table public.property_agents enable row level security;

drop policy if exists "property_agents_select_public" on public.property_agents;
create policy "property_agents_select_public"
  on public.property_agents for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Seed brokers + agents (display-only, mirrors earlier seed pattern)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_id_fkey') then
    alter table public.profiles drop constraint profiles_id_fkey;
  end if;
exception when others then
  null;
end $$;

-- Broker profiles (stable IDs)
insert into public.profiles (id, full_name, avatar_url, role)
values
  ('c3000000-0000-0000-0000-000000000001', 'RE/MAX', null, 'broker'),
  ('c3000000-0000-0000-0000-000000000002', 'Ayala Land Premier', null, 'broker'),
  ('c3000000-0000-0000-0000-000000000003', 'Filinvest', null, 'broker'),
  ('c3000000-0000-0000-0000-000000000004', 'BGC Luxury Homes', null, 'broker'),
  ('c3000000-0000-0000-0000-000000000005', 'Century 21', null, 'broker'),
  ('c3000000-0000-0000-0000-000000000006', 'Megaworld', null, 'broker'),
  ('c3000000-0000-0000-0000-000000000007', 'DMCI Homes', null, 'broker'),
  ('c3000000-0000-0000-0000-000000000008', 'Robinsons Land', null, 'broker'),
  ('c3000000-0000-0000-0000-000000000009', 'Vista Land', null, 'broker'),
  ('c3000000-0000-0000-0000-00000000000a', 'Federal Land', null, 'broker')
on conflict (id) do nothing;

-- Broker rows (stable IDs for joins)
insert into public.brokers (
  id, name, company_name, license_number, email, phone, logo_url, status, verified, user_id
)
values
  ('d4000000-0000-0000-0000-000000000001', 'RE/MAX', 'RE/MAX', 'PRC-BR-2026-001', 'broker.remax@fishnet.test', '+63 2 8100 0001', null, 'approved', true, 'c3000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000002', 'Ayala Land Premier', 'Ayala Land Premier', 'PRC-BR-2026-002', 'broker.ayala@fishnet.test', '+63 2 8100 0002', null, 'approved', true, 'c3000000-0000-0000-0000-000000000002'),
  ('d4000000-0000-0000-0000-000000000003', 'Filinvest', 'Filinvest', 'PRC-BR-2026-003', 'broker.filinvest@fishnet.test', '+63 2 8100 0003', null, 'approved', true, 'c3000000-0000-0000-0000-000000000003'),
  ('d4000000-0000-0000-0000-000000000004', 'BGC Luxury Homes', 'BGC Luxury Homes', 'PRC-BR-2026-004', 'broker.bgc@fishnet.test', '+63 2 8100 0004', null, 'approved', true, 'c3000000-0000-0000-0000-000000000004'),
  ('d4000000-0000-0000-0000-000000000005', 'Century 21', 'Century 21', 'PRC-BR-2026-005', 'broker.c21@fishnet.test', '+63 2 8100 0005', null, 'approved', true, 'c3000000-0000-0000-0000-000000000005'),
  ('d4000000-0000-0000-0000-000000000006', 'Megaworld', 'Megaworld', 'PRC-BR-2026-006', 'broker.megaworld@fishnet.test', '+63 2 8100 0006', null, 'approved', true, 'c3000000-0000-0000-0000-000000000006'),
  ('d4000000-0000-0000-0000-000000000007', 'DMCI Homes', 'DMCI Homes', 'PRC-BR-2026-007', 'broker.dmci@fishnet.test', '+63 2 8100 0007', null, 'approved', true, 'c3000000-0000-0000-0000-000000000007'),
  ('d4000000-0000-0000-0000-000000000008', 'Robinsons Land', 'Robinsons Land', 'PRC-BR-2026-008', 'broker.robinsons@fishnet.test', '+63 2 8100 0008', null, 'approved', true, 'c3000000-0000-0000-0000-000000000008'),
  ('d4000000-0000-0000-0000-000000000009', 'Vista Land', 'Vista Land', 'PRC-BR-2026-009', 'broker.vista@fishnet.test', '+63 2 8100 0009', null, 'approved', true, 'c3000000-0000-0000-0000-000000000009'),
  ('d4000000-0000-0000-0000-00000000000a', 'Federal Land', 'Federal Land', 'PRC-BR-2026-010', 'broker.federal@fishnet.test', '+63 2 8100 0010', null, 'approved', true, 'c3000000-0000-0000-0000-00000000000a')
on conflict (user_id) do nothing;

-- Agent profiles (stable IDs)
insert into public.profiles (id, full_name, avatar_url, role)
values
  ('e5000000-0000-0000-0000-000000000001', 'Sarah Reyes', null, 'agent'),
  ('e5000000-0000-0000-0000-000000000002', 'James Santos', null, 'agent'),
  ('e5000000-0000-0000-0000-000000000003', 'Ken Dela Cruz', null, 'agent'),
  ('e5000000-0000-0000-0000-000000000004', 'Mia Tan', null, 'agent'),
  ('e5000000-0000-0000-0000-000000000005', 'Carlos Mendoza', null, 'agent'),
  ('e5000000-0000-0000-0000-000000000006', 'Ana Reyes', null, 'agent'),
  ('e5000000-0000-0000-0000-000000000007', 'Rico Garcia', null, 'agent'),
  ('e5000000-0000-0000-0000-000000000008', 'Lisa Villanueva', null, 'agent'),
  ('e5000000-0000-0000-0000-000000000009', 'Mark Aquino', null, 'agent'),
  ('e5000000-0000-0000-0000-00000000000a', 'Grace Lim', null, 'agent')
on conflict (id) do nothing;

-- Agents (IDs stable for property_agents)
insert into public.agents (
  id,
  name,
  email,
  phone,
  image_url,
  license_number,
  score,
  closings,
  response_time,
  availability,
  broker_id,
  status,
  verified,
  user_id
)
values
  ('f6000000-0000-0000-0000-000000000001', 'Sarah Reyes', 'sarah.reyes@fishnet.test', null, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-101', 95, 360, 'Fast', 'Available Now', 'd4000000-0000-0000-0000-000000000001', 'approved', true, 'e5000000-0000-0000-0000-000000000001'),
  ('f6000000-0000-0000-0000-000000000002', 'James Santos', 'james.santos@fishnet.test', null, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-102', 93, 340, 'Fast', 'Today 5PM', 'd4000000-0000-0000-0000-000000000002', 'approved', true, 'e5000000-0000-0000-0000-000000000002'),
  ('f6000000-0000-0000-0000-000000000003', 'Ken Dela Cruz', 'ken.delacruz@fishnet.test', null, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-103', 88, 290, 'Fast', 'Available Now', 'd4000000-0000-0000-0000-000000000003', 'approved', true, 'e5000000-0000-0000-0000-000000000003'),
  ('f6000000-0000-0000-0000-000000000004', 'Mia Tan', 'mia.tan@fishnet.test', null, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-104', 92, 310, 'Fast', 'Tomorrow', 'd4000000-0000-0000-0000-000000000004', 'approved', true, 'e5000000-0000-0000-0000-000000000004'),
  ('f6000000-0000-0000-0000-000000000005', 'Carlos Mendoza', 'carlos.mendoza@fishnet.test', null, 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-105', 85, 250, 'Fast', 'Available Now', 'd4000000-0000-0000-0000-000000000005', 'approved', true, 'e5000000-0000-0000-0000-000000000005'),
  ('f6000000-0000-0000-0000-000000000006', 'Ana Reyes', 'ana.reyes@fishnet.test', null, 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-106', 90, 280, 'Fast', 'Available Now', 'd4000000-0000-0000-0000-000000000006', 'approved', true, 'e5000000-0000-0000-0000-000000000006'),
  ('f6000000-0000-0000-0000-000000000007', 'Rico Garcia', 'rico.garcia@fishnet.test', null, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-107', 87, 220, 'Fast', 'Today 3PM', 'd4000000-0000-0000-0000-000000000007', 'approved', true, 'e5000000-0000-0000-0000-000000000007'),
  ('f6000000-0000-0000-0000-000000000008', 'Lisa Villanueva', 'lisa.villanueva@fishnet.test', null, 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-108', 91, 300, 'Fast', 'Available Now', 'd4000000-0000-0000-0000-000000000008', 'approved', true, 'e5000000-0000-0000-0000-000000000008'),
  ('f6000000-0000-0000-0000-000000000009', 'Mark Aquino', 'mark.aquino@fishnet.test', null, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-109', 86, 235, 'Fast', 'Tomorrow', 'd4000000-0000-0000-0000-000000000009', 'approved', true, 'e5000000-0000-0000-0000-000000000009'),
  ('f6000000-0000-0000-0000-00000000000a', 'Grace Lim', 'grace.lim@fishnet.test', null, 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=256&h=256&fit=crop&crop=face', 'PRC-AG-2026-110', 89, 265, 'Fast', 'Available Now', 'd4000000-0000-0000-0000-00000000000a', 'approved', true, 'e5000000-0000-0000-0000-00000000000a')
on conflict (user_id) do nothing;

-- Re-add the FK as NOT VALID (optional, keeps schema intent without blocking seed).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey') then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id)
      references auth.users(id)
      on delete cascade
      not valid;
  end if;
exception when others then
  null;
end $$;

-- ---------------------------------------------------------------------------
-- Seed 10 properties (ids stable for junctions)
-- ---------------------------------------------------------------------------
insert into public.properties (
  id,
  created_at,
  name,
  location,
  price,
  sqft,
  beds,
  baths,
  image_url,
  status,
  listed_by
)
values
  ('a7000000-0000-0000-0000-000000000001', now() - interval '2 hours',  'Forbes Park Villa',          'Forbes Park, Makati',            '₱85M',  '5,200', 6, 6, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-000000000002', now() - interval '5 hours',  'BGC Penthouse',              'BGC, Taguig',                   '₱45M',  '2,800', 3, 3, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000004'),
  ('a7000000-0000-0000-0000-000000000003', now() - interval '9 hours',  'Makati CBD Condo',           'Makati CBD, Makati',            '₱12M',  '980',   2, 2, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000002'),
  ('a7000000-0000-0000-0000-000000000004', now() - interval '14 hours', 'Alabang Hills Estate',       'Alabang Hills, Muntinlupa',     '₱68M',  '4,800', 5, 5, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000003'),
  ('a7000000-0000-0000-0000-000000000005', now() - interval '20 hours', 'Tagaytay Ridge Villa',       'Tagaytay, Cavite',              '₱28M',  '3,200', 4, 3, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-00000000000a'),
  ('a7000000-0000-0000-0000-000000000006', now() - interval '26 hours', 'Ortigas Center Loft',        'Ortigas, Pasig',                '₱8.5M', '650',   1, 1, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop',    'for_rent', 'e5000000-0000-0000-0000-000000000008'),
  ('a7000000-0000-0000-0000-000000000007', now() - interval '30 hours', 'Pasig Riverside Condo',      'Pasig, Metro Manila',           '₱6.2M', '820',   2, 1, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop',    'for_rent', 'e5000000-0000-0000-0000-000000000006'),
  ('a7000000-0000-0000-0000-000000000008', now() - interval '34 hours', 'San Juan Townhouse',         'San Juan, Metro Manila',        '₱18M',  '1,800', 3, 2, 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop',    'for_sale', 'e5000000-0000-0000-0000-000000000005'),
  ('a7000000-0000-0000-0000-000000000009', now() - interval '40 hours', 'Quezon City Family Home',    'Quezon City, Metro Manila',     '₱22M',  '2,400', 4, 3, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&h=1100&fit=crop',    'for_sale', 'e5000000-0000-0000-0000-000000000007'),
  ('a7000000-0000-0000-0000-00000000000a', now() - interval '46 hours', 'Mandaluyong Studio',         'Mandaluyong, Metro Manila',     '₱4.8M', '420',   0, 1, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop',    'for_rent', 'e5000000-0000-0000-0000-000000000009'),

  ('a7000000-0000-0000-0000-00000000000b', now() - interval '3 hours',  'Rockwell Center Condo',      'Rockwell Center, Makati',       '₱35M',  '1,650', 3, 2, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000004'),
  ('a7000000-0000-0000-0000-00000000000c', now() - interval '7 hours',  'Bonifacio High Street Loft', 'Bonifacio High Street, Taguig', '₱28M',  '1,250', 2, 2, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000002'),
  ('a7000000-0000-0000-0000-00000000000d', now() - interval '11 hours', 'Eastwood City Studio',       'Eastwood City, Quezon City',    '₱5.5M', '380',   0, 1, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop',    'for_rent', 'e5000000-0000-0000-0000-000000000008'),
  ('a7000000-0000-0000-0000-00000000000e', now() - interval '16 hours', 'McKinley Hill Villa',        'McKinley Hill, Taguig',         '₱55M',  '4,100', 4, 4, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-00000000000f', now() - interval '22 hours', 'Greenhills Townhouse',       'Greenhills, San Juan',          '₱15M',  '1,700', 3, 2, 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000005'),
  ('a7000000-0000-0000-0000-000000000010', now() - interval '28 hours', 'Kapitolyo Condo',            'Kapitolyo, Pasig',              '₱7.8M', '720',   2, 1, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 'for_rent', 'e5000000-0000-0000-0000-000000000006'),
  ('a7000000-0000-0000-0000-000000000011', now() - interval '36 hours', 'Taguig River Park',          'Taguig, Metro Manila',          '₱42M',  '2,600', 3, 3, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000007')
on conflict (id) do update set
  created_at = excluded.created_at,
  name = excluded.name,
  location = excluded.location,
  price = excluded.price,
  sqft = excluded.sqft,
  beds = excluded.beds,
  baths = excluded.baths,
  image_url = excluded.image_url,
  status = excluded.status,
  listed_by = excluded.listed_by;

-- ---------------------------------------------------------------------------
-- Seed room photos (4 per property)
-- ---------------------------------------------------------------------------
delete from public.property_photos where property_id in (
  'a7000000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000003','a7000000-0000-0000-0000-000000000004','a7000000-0000-0000-0000-000000000005',
  'a7000000-0000-0000-0000-000000000006','a7000000-0000-0000-0000-000000000007','a7000000-0000-0000-0000-000000000008','a7000000-0000-0000-0000-000000000009','a7000000-0000-0000-0000-00000000000a'
  ,'a7000000-0000-0000-0000-00000000000b','a7000000-0000-0000-0000-00000000000c','a7000000-0000-0000-0000-00000000000d','a7000000-0000-0000-0000-00000000000e','a7000000-0000-0000-0000-00000000000f'
  ,'a7000000-0000-0000-0000-000000000010','a7000000-0000-0000-0000-000000000011'
);

insert into public.property_photos (property_id, url, sort_order)
values
  ('a7000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000008', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000008', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000008', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000008', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000009', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000009', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000009', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000009', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-00000000000a', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-00000000000a', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-00000000000a', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-00000000000a', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-00000000000b', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-00000000000b', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-00000000000b', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-00000000000b', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-00000000000c', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-00000000000c', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-00000000000c', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-00000000000c', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-00000000000d', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-00000000000d', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-00000000000d', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-00000000000d', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-00000000000e', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-00000000000e', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-00000000000e', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-00000000000e', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-00000000000f', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-00000000000f', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-00000000000f', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-00000000000f', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000010', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000010', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000010', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000010', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop', 3),

  ('a7000000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 1),
  ('a7000000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&h=1100&fit=crop', 2),
  ('a7000000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 3);

-- ---------------------------------------------------------------------------
-- Seed property-agent connections (2–3 per property)
-- ---------------------------------------------------------------------------
delete from public.property_agents where property_id in (
  'a7000000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000003','a7000000-0000-0000-0000-000000000004','a7000000-0000-0000-0000-000000000005',
  'a7000000-0000-0000-0000-000000000006','a7000000-0000-0000-0000-000000000007','a7000000-0000-0000-0000-000000000008','a7000000-0000-0000-0000-000000000009','a7000000-0000-0000-0000-00000000000a'
  ,'a7000000-0000-0000-0000-00000000000b','a7000000-0000-0000-0000-00000000000c','a7000000-0000-0000-0000-00000000000d','a7000000-0000-0000-0000-00000000000e','a7000000-0000-0000-0000-00000000000f'
  ,'a7000000-0000-0000-0000-000000000010','a7000000-0000-0000-0000-000000000011'
);

insert into public.property_agents (property_id, agent_id)
values
  ('a7000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000008'),
  ('a7000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-00000000000a'),

  ('a7000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000004'),
  ('a7000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000002'),
  ('a7000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000006'),

  ('a7000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000002'),
  ('a7000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000001'),

  ('a7000000-0000-0000-0000-000000000004', 'f6000000-0000-0000-0000-000000000003'),
  ('a7000000-0000-0000-0000-000000000004', 'f6000000-0000-0000-0000-000000000005'),
  ('a7000000-0000-0000-0000-000000000004', 'f6000000-0000-0000-0000-000000000007'),

  ('a7000000-0000-0000-0000-000000000005', 'f6000000-0000-0000-0000-00000000000a'),
  ('a7000000-0000-0000-0000-000000000005', 'f6000000-0000-0000-0000-000000000004'),

  ('a7000000-0000-0000-0000-000000000006', 'f6000000-0000-0000-0000-000000000008'),
  ('a7000000-0000-0000-0000-000000000006', 'f6000000-0000-0000-0000-000000000006'),

  ('a7000000-0000-0000-0000-000000000007', 'f6000000-0000-0000-0000-000000000006'),
  ('a7000000-0000-0000-0000-000000000007', 'f6000000-0000-0000-0000-000000000007'),
  ('a7000000-0000-0000-0000-000000000007', 'f6000000-0000-0000-0000-000000000009'),

  ('a7000000-0000-0000-0000-000000000008', 'f6000000-0000-0000-0000-000000000005'),
  ('a7000000-0000-0000-0000-000000000008', 'f6000000-0000-0000-0000-000000000001'),

  ('a7000000-0000-0000-0000-000000000009', 'f6000000-0000-0000-0000-000000000007'),
  ('a7000000-0000-0000-0000-000000000009', 'f6000000-0000-0000-0000-000000000009'),
  ('a7000000-0000-0000-0000-000000000009', 'f6000000-0000-0000-0000-000000000008'),

  ('a7000000-0000-0000-0000-00000000000a', 'f6000000-0000-0000-0000-000000000009'),
  ('a7000000-0000-0000-0000-00000000000a', 'f6000000-0000-0000-0000-000000000006'),

  ('a7000000-0000-0000-0000-00000000000b', 'f6000000-0000-0000-0000-000000000004'),
  ('a7000000-0000-0000-0000-00000000000b', 'f6000000-0000-0000-0000-000000000002'),
  ('a7000000-0000-0000-0000-00000000000b', 'f6000000-0000-0000-0000-000000000006'),

  ('a7000000-0000-0000-0000-00000000000c', 'f6000000-0000-0000-0000-000000000002'),
  ('a7000000-0000-0000-0000-00000000000c', 'f6000000-0000-0000-0000-000000000004'),
  ('a7000000-0000-0000-0000-00000000000c', 'f6000000-0000-0000-0000-000000000001'),

  ('a7000000-0000-0000-0000-00000000000d', 'f6000000-0000-0000-0000-000000000008'),
  ('a7000000-0000-0000-0000-00000000000d', 'f6000000-0000-0000-0000-000000000007'),

  ('a7000000-0000-0000-0000-00000000000e', 'f6000000-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-00000000000e', 'f6000000-0000-0000-0000-00000000000a'),
  ('a7000000-0000-0000-0000-00000000000e', 'f6000000-0000-0000-0000-000000000004'),

  ('a7000000-0000-0000-0000-00000000000f', 'f6000000-0000-0000-0000-000000000005'),
  ('a7000000-0000-0000-0000-00000000000f', 'f6000000-0000-0000-0000-000000000009'),

  ('a7000000-0000-0000-0000-000000000010', 'f6000000-0000-0000-0000-000000000006'),
  ('a7000000-0000-0000-0000-000000000010', 'f6000000-0000-0000-0000-000000000008'),
  ('a7000000-0000-0000-0000-000000000010', 'f6000000-0000-0000-0000-000000000002'),

  ('a7000000-0000-0000-0000-000000000011', 'f6000000-0000-0000-0000-000000000007'),
  ('a7000000-0000-0000-0000-000000000011', 'f6000000-0000-0000-0000-000000000004'),
  ('a7000000-0000-0000-0000-000000000011', 'f6000000-0000-0000-0000-000000000008');

