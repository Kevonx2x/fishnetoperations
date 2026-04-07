-- Server-backed saves (optional; marketplace hearts can sync here later).
-- Public aggregate counts via SECURITY DEFINER RPC for profile "heart" totals.

create table if not exists public.saved_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

create index if not exists saved_properties_property_id_idx on public.saved_properties (property_id);
create index if not exists saved_properties_user_id_idx on public.saved_properties (user_id);

alter table public.saved_properties enable row level security;

drop policy if exists "saved_properties_select_own" on public.saved_properties;
create policy "saved_properties_select_own"
  on public.saved_properties for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "saved_properties_insert_own" on public.saved_properties;
create policy "saved_properties_insert_own"
  on public.saved_properties for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "saved_properties_delete_own" on public.saved_properties;
create policy "saved_properties_delete_own"
  on public.saved_properties for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.saved_properties is 'User-saved listings; counts exposed via property_save_counts_for()';

create or replace function public.property_save_counts_for(property_ids uuid[])
returns table (property_id uuid, save_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.property_id, count(*)::bigint as save_count
  from public.saved_properties s
  where s.property_id = any(property_ids)
  group by s.property_id;
$$;

comment on function public.property_save_counts_for(uuid[]) is 'Batch save counts for public agent feed (no user rows exposed).';

grant execute on function public.property_save_counts_for(uuid[]) to anon, authenticated;
