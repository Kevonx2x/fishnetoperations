-- Demo: 6 additional approved agents (scores 3.5–5.0), mixed brokers, PH locations.
-- Each agent has 1–2 properties + property_agents rows for marketplace / similar-agents testing.
--
-- profiles.id normally references auth.users. For demo rows without auth users, drop FK,
-- insert, then re-add as NOT VALID (same pattern as 20260330110000_seed_fake_brokers_agents.sql).

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_id_fkey') then
    alter table public.profiles drop constraint profiles_id_fkey;
  end if;
exception when others then
  null;
end $$;

-- Agent profile rows (stable UUIDs)
insert into public.profiles (id, full_name, avatar_url, role)
values
  ('e5000000-0000-0000-0000-00000000000b', 'Mariela Bautista', null, 'agent'),
  ('e5000000-0000-0000-0000-00000000000c', 'José Pascual', null, 'agent'),
  ('e5000000-0000-0000-0000-00000000000d', 'Rowena Macaraig', null, 'agent'),
  ('e5000000-0000-0000-0000-00000000000e', 'Paolo Ramirez', null, 'agent'),
  ('e5000000-0000-0000-0000-00000000000f', 'Danica Flores', null, 'agent'),
  ('e5000000-0000-0000-0000-000000000010', 'Miguel Ocampo', null, 'agent')
on conflict (id) do nothing;

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
  (
    'f6000000-0000-0000-0000-00000000000b',
    'Mariela Bautista',
    'mariela.bautista@fishnet.test',
    '+63 917 801 0001',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=256&h=256&fit=crop&crop=face',
    'PRC-AG-2026-201',
    3.5,
    28,
    'Within 24 hours',
    'Available Now',
    'd4000000-0000-0000-0000-000000000001',
    'approved',
    true,
    'e5000000-0000-0000-0000-00000000000b'
  ),
  (
    'f6000000-0000-0000-0000-00000000000c',
    'José Pascual',
    'jose.pascual@fishnet.test',
    '+63 917 801 0002',
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&h=256&fit=crop&crop=face',
    'PRC-AG-2026-202',
    4.0,
    34,
    'Same day',
    'Available Now',
    'd4000000-0000-0000-0000-000000000003',
    'approved',
    true,
    'e5000000-0000-0000-0000-00000000000c'
  ),
  (
    'f6000000-0000-0000-0000-00000000000d',
    'Rowena Macaraig',
    'rowena.macaraig@fishnet.test',
    '+63 917 801 0003',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&h=256&fit=crop&crop=face',
    'PRC-AG-2026-203',
    4.2,
    41,
    'Within 12 hours',
    'Available Now',
    'd4000000-0000-0000-0000-000000000004',
    'approved',
    true,
    'e5000000-0000-0000-0000-00000000000d'
  ),
  (
    'f6000000-0000-0000-0000-00000000000e',
    'Paolo Ramirez',
    'paolo.ramirez@fishnet.test',
    '+63 917 801 0004',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=256&h=256&fit=crop&crop=face',
    'PRC-AG-2026-204',
    4.5,
    19,
    'Within 48 hours',
    'Available Now',
    'd4000000-0000-0000-0000-000000000005',
    'approved',
    true,
    'e5000000-0000-0000-0000-00000000000e'
  ),
  (
    'f6000000-0000-0000-0000-00000000000f',
    'Danica Flores',
    'danica.flores@fishnet.test',
    '+63 917 801 0005',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=face',
    'PRC-AG-2026-205',
    4.8,
    52,
    'Within 24 hours',
    'Available Now',
    'd4000000-0000-0000-0000-000000000006',
    'approved',
    true,
    'e5000000-0000-0000-0000-00000000000f'
  ),
  (
    'f6000000-0000-0000-0000-000000000010',
    'Miguel Ocampo',
    'miguel.ocampo@fishnet.test',
    '+63 917 801 0006',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=face',
    'PRC-AG-2026-206',
    5.0,
    61,
    'Same day',
    'Available Now',
    'd4000000-0000-0000-0000-000000000002',
    'approved',
    true,
    'e5000000-0000-0000-0000-000000000010'
  )
on conflict (user_id) do nothing;

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
  ('a7000000-0000-0000-0000-000000000012', now() - interval '1 hour', 'Legazpi Village Loft', 'Legazpi Village, Makati', '₱9.2M', '780', 2, 2, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-00000000000b'),
  ('a7000000-0000-0000-0000-000000000013', now() - interval '2 hours', 'Salcedo Park View', 'Salcedo Village, Makati', '₱14.5M', '1,100', 3, 2, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-00000000000b'),
  ('a7000000-0000-0000-0000-000000000014', now() - interval '3 hours', 'Cebu IT Park Condo', 'Cebu IT Park, Cebu City', '₱6.8M', '920', 2, 2, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 'for_rent', 'e5000000-0000-0000-0000-00000000000c'),
  ('a7000000-0000-0000-0000-000000000015', now() - interval '4 hours', 'Uptown BGC Suite', 'Uptown Bonifacio, Taguig', '₱18M', '1,400', 2, 2, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-00000000000d'),
  ('a7000000-0000-0000-0000-000000000016', now() - interval '5 hours', 'Forbes Town Residence', 'Forbes Town Center, Taguig', '₱32M', '2,100', 3, 3, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-00000000000d'),
  ('a7000000-0000-0000-0000-000000000017', now() - interval '6 hours', 'Subic Bay Townhome', 'Subic Bay Freeport, Olongapo', '₱11M', '1,650', 3, 2, 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-00000000000e'),
  ('a7000000-0000-0000-0000-000000000018', now() - interval '7 hours', 'Ortigas Garden Villa', 'Ortigas Center, Pasig', '₱24M', '2,400', 4, 3, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-00000000000f'),
  ('a7000000-0000-0000-0000-000000000019', now() - interval '8 hours', 'Kapitolyo Walk-up', 'Kapitolyo, Pasig', '₱7.1M', '680', 2, 1, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop', 'for_rent', 'e5000000-0000-0000-0000-00000000000f'),
  ('a7000000-0000-0000-0000-00000000001a', now() - interval '9 hours', 'Katipunan Avenue Home', 'Katipunan, Quezon City', '₱16M', '1,900', 3, 2, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop', 'for_sale', 'e5000000-0000-0000-0000-000000000010')
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

delete from public.property_photos where property_id in (
  'a7000000-0000-0000-0000-000000000012','a7000000-0000-0000-0000-000000000013','a7000000-0000-0000-0000-000000000014',
  'a7000000-0000-0000-0000-000000000015','a7000000-0000-0000-0000-000000000016','a7000000-0000-0000-0000-000000000017',
  'a7000000-0000-0000-0000-000000000018','a7000000-0000-0000-0000-000000000019','a7000000-0000-0000-0000-00000000001a'
);

insert into public.property_photos (property_id, url, sort_order)
values
  ('a7000000-0000-0000-0000-000000000012', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000013', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000014', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000015', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000016', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000017', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000018', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-000000000019', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=1100&fit=crop', 0),
  ('a7000000-0000-0000-0000-00000000001a', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=1100&fit=crop', 0);

insert into public.property_agents (property_id, agent_id)
values
  ('a7000000-0000-0000-0000-000000000012', 'f6000000-0000-0000-0000-00000000000b'),
  ('a7000000-0000-0000-0000-000000000013', 'f6000000-0000-0000-0000-00000000000b'),
  ('a7000000-0000-0000-0000-000000000014', 'f6000000-0000-0000-0000-00000000000c'),
  ('a7000000-0000-0000-0000-000000000015', 'f6000000-0000-0000-0000-00000000000d'),
  ('a7000000-0000-0000-0000-000000000016', 'f6000000-0000-0000-0000-00000000000d'),
  ('a7000000-0000-0000-0000-000000000017', 'f6000000-0000-0000-0000-00000000000e'),
  ('a7000000-0000-0000-0000-000000000018', 'f6000000-0000-0000-0000-00000000000f'),
  ('a7000000-0000-0000-0000-000000000019', 'f6000000-0000-0000-0000-00000000000f'),
  ('a7000000-0000-0000-0000-00000000001a', 'f6000000-0000-0000-0000-000000000010')
on conflict (property_id, agent_id) do nothing;

-- Restore FK (NOT VALID allows existing demo rows; validate later in production if needed)
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
