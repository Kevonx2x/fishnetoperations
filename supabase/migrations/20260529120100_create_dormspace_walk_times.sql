-- Walking distance from dormspace listings to seeded universities (Distance Matrix API cache).
-- Requires 20260529120000_create_universities_table.sql first.
-- Review with TJ before running in Supabase SQL Editor.

create table if not exists public.dormspace_walk_times (
  id uuid primary key default gen_random_uuid(),
  dormspace_id uuid not null references public.dormspaces(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  walk_duration_seconds integer not null,
  walk_distance_meters integer not null,
  calculated_at timestamptz not null default now(),
  unique (dormspace_id, university_id)
);

create index if not exists idx_walk_times_dormspace on public.dormspace_walk_times (dormspace_id);
create index if not exists idx_walk_times_university on public.dormspace_walk_times (university_id);

alter table public.dormspace_walk_times enable row level security;

drop policy if exists "Anyone can view walk times" on public.dormspace_walk_times;
create policy "Anyone can view walk times"
  on public.dormspace_walk_times
  for select
  using (true);

drop policy if exists "Service role only inserts" on public.dormspace_walk_times;
create policy "Service role only inserts"
  on public.dormspace_walk_times
  for insert
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  );

drop policy if exists "Admins can manage walk times" on public.dormspace_walk_times;
create policy "Admins can manage walk times"
  on public.dormspace_walk_times
  for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  );

drop policy if exists "Admins can delete walk times" on public.dormspace_walk_times;
create policy "Admins can delete walk times"
  on public.dormspace_walk_times
  for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'ops_admin')
  );

comment on table public.dormspace_walk_times is
  'Cached Google Distance Matrix walking times from dormspace coordinates to each active university.';
