-- Dormspace saves + landlord public profile fields + engagement RLS for counts

-- Landlord public identity (tenant-facing on listing detail)
alter table public.profiles add column if not exists landlord_bio text;
alter table public.profiles add column if not exists landlord_languages text[];
alter table public.profiles add column if not exists landlord_preferred_contact text;
alter table public.profiles add column if not exists landlord_years_renting integer;

alter table public.profiles drop constraint if exists profiles_landlord_preferred_contact_check;
alter table public.profiles
  add constraint profiles_landlord_preferred_contact_check
  check (
    landlord_preferred_contact is null
    or landlord_preferred_contact in ('email', 'phone', 'either')
  );

comment on column public.profiles.landlord_bio is 'Public landlord bio shown on dormspace listings (max ~500 chars in app).';
comment on column public.profiles.landlord_languages is 'Languages spoken by landlord (tenant-facing).';
comment on column public.profiles.landlord_preferred_contact is 'Preferred contact: email, phone, or either.';
comment on column public.profiles.landlord_years_renting is 'Years the landlord has been renting out properties.';

-- Saves / pins (likes table may already exist from 20260520120000_dormspace_likes.sql)
create table if not exists public.dormspace_saves (
  id uuid primary key default gen_random_uuid(),
  dormspace_id uuid not null references public.dormspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dormspace_id, user_id)
);

create index if not exists idx_dormspace_saves_dormspace_id on public.dormspace_saves(dormspace_id);
create index if not exists idx_dormspace_saves_user_id on public.dormspace_saves(user_id);

alter table public.dormspace_saves enable row level security;

drop policy if exists dormspace_saves_insert on public.dormspace_saves;
create policy dormspace_saves_insert on public.dormspace_saves
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists dormspace_saves_delete on public.dormspace_saves;
create policy dormspace_saves_delete on public.dormspace_saves
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists dormspace_saves_select on public.dormspace_saves;
create policy dormspace_saves_select on public.dormspace_saves
  for select
  using (true);

-- Allow public read of like rows for counts; keep own-row write policies
drop policy if exists dormspace_likes_select_own on public.dormspace_likes;
drop policy if exists dormspace_likes_select on public.dormspace_likes;
create policy dormspace_likes_select on public.dormspace_likes
  for select
  using (true);

notify pgrst, 'reload schema';
