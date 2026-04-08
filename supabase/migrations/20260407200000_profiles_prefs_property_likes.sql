-- Client profile preferences + property likes (hearts) separate from saved_properties (pins)

alter table public.profiles add column if not exists country_of_origin text;
alter table public.profiles add column if not exists visa_type text;
alter table public.profiles add column if not exists visa_expiry date;
alter table public.profiles add column if not exists budget_min numeric;
alter table public.profiles add column if not exists budget_max numeric;
alter table public.profiles add column if not exists preferred_property_type text;
alter table public.profiles add column if not exists preferred_locations jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists looking_to text;

alter table public.profiles drop constraint if exists profiles_looking_to_check;
alter table public.profiles
  add constraint profiles_looking_to_check
  check (looking_to is null or looking_to in ('buy', 'rent', 'both'));

comment on column public.profiles.preferred_locations is 'JSON array of location label strings';

-- Likes (hearts), distinct from saved_properties (pins / wishlist)
create table if not exists public.property_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create index if not exists property_likes_property_id_idx on public.property_likes (property_id);

alter table public.property_likes enable row level security;

drop policy if exists "property_likes_select_own" on public.property_likes;
create policy "property_likes_select_own"
  on public.property_likes for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "property_likes_insert_own" on public.property_likes;
create policy "property_likes_insert_own"
  on public.property_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "property_likes_delete_own" on public.property_likes;
create policy "property_likes_delete_own"
  on public.property_likes for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.property_like_counts_for(property_ids uuid[])
returns table (property_id uuid, like_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.property_id, count(*)::bigint as like_count
  from public.property_likes l
  where l.property_id = any(property_ids)
  group by l.property_id;
$$;

comment on function public.property_like_counts_for(uuid[]) is 'Batch like counts for property cards (public aggregate).';

grant execute on function public.property_like_counts_for(uuid[]) to anon, authenticated;
