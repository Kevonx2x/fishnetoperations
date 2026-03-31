-- Seed fake brokers + agents for marketplace UI demos (NO auth.users writes).
--
-- We insert directly into public.profiles using hardcoded UUIDs, then create
-- brokers/agents that reference those profile IDs via `user_id`.
--
-- NOTE: public.profiles.id normally has an FK to auth.users(id). For display-only
-- test records, we drop that FK (if present) and then re-add it as NOT VALID so:
-- - the seeded rows are allowed
-- - future inserts can still be constrained once you `VALIDATE CONSTRAINT`
--
-- This is intentionally "dev/demo seed" behavior.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_id_fkey') then
    alter table public.profiles drop constraint profiles_id_fkey;
  end if;
exception when others then
  null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (hardcoded UUIDs)
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, avatar_url, role)
values
  ('a1000000-0000-0000-0000-000000000001', 'Metro Realty Group', null, 'broker'),
  ('a1000000-0000-0000-0000-000000000002', 'Ayala Premier Properties', null, 'broker'),
  ('a1000000-0000-0000-0000-000000000003', 'BGC Luxury Homes', null, 'broker'),
  ('a1000000-0000-0000-0000-000000000101', 'Sarah Reyes', null, 'agent'),
  ('a1000000-0000-0000-0000-000000000102', 'James Santos', null, 'agent'),
  ('a1000000-0000-0000-0000-000000000103', 'Kennessam (Ken) Dela Cruz', null, 'agent'),
  ('a1000000-0000-0000-0000-000000000104', 'Mia Tan', null, 'agent'),
  ('a1000000-0000-0000-0000-000000000105', 'Carlos Mendoza', null, 'agent')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Brokers (stable IDs)
-- ---------------------------------------------------------------------------
insert into public.brokers (
  id,
  name,
  company_name,
  license_number,
  email,
  phone,
  logo_url,
  status,
  verified,
  user_id
)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'Metro Realty Group',
    'Metro Realty Group',
    'PRC-BR-2024-001',
    'metro@fishnet.test',
    '+63 2 8123 0001',
    null,
    'approved',
    true,
    'a1000000-0000-0000-0000-000000000001'
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'Ayala Premier Properties',
    'Ayala Premier Properties',
    'PRC-BR-2024-002',
    'ayala@fishnet.test',
    '+63 2 8123 0002',
    null,
    'approved',
    true,
    'a1000000-0000-0000-0000-000000000002'
  ),
  (
    'b2000000-0000-0000-0000-000000000003',
    'BGC Luxury Homes',
    'BGC Luxury Homes',
    'PRC-BR-2024-003',
    'bgc@fishnet.test',
    '+63 2 8123 0003',
    null,
    'approved',
    true,
    'a1000000-0000-0000-0000-000000000003'
  )
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Agents (linked to brokers)
-- ---------------------------------------------------------------------------
insert into public.agents (
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
    'Sarah Reyes',
    'sarah.reyes@fishnet.test',
    null,
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    'PRC-AG-2024-101',
    95,
    360,
    'Fast',
    'Available Now',
    'b2000000-0000-0000-0000-000000000001',
    'approved',
    true,
    'a1000000-0000-0000-0000-000000000101'
  ),
  (
    'James Santos',
    'james.santos@fishnet.test',
    null,
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    'PRC-AG-2024-102',
    93,
    340,
    'Fast',
    'Available Today',
    'b2000000-0000-0000-0000-000000000002',
    'approved',
    true,
    'a1000000-0000-0000-0000-000000000102'
  ),
  (
    'Kennessam (Ken) Dela Cruz',
    'ken.dela.cruz@fishnet.test',
    null,
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    'PRC-AG-2024-103',
    88,
    290,
    'Fast',
    'Available Now',
    null,
    'approved',
    true,
    'a1000000-0000-0000-0000-000000000103'
  ),
  (
    'Mia Tan',
    'mia.tan@fishnet.test',
    null,
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    'PRC-AG-2024-104',
    92,
    310,
    'Fast',
    'Tomorrow',
    'b2000000-0000-0000-0000-000000000003',
    'approved',
    true,
    'a1000000-0000-0000-0000-000000000104'
  ),
  (
    'Carlos Mendoza',
    'carlos.mendoza@fishnet.test',
    null,
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
    'PRC-AG-2024-105',
    85,
    250,
    'Fast',
    'Available Now',
    null,
    'approved',
    true,
    'a1000000-0000-0000-0000-000000000105'
  )
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

