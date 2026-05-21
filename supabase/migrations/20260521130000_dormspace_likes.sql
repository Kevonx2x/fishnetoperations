-- Dormspace likes (hearts) for student/tenant browse — separate from property_likes

create table if not exists public.dormspace_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  dormspace_id uuid not null references public.dormspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dormspace_id)
);

create index if not exists dormspace_likes_dormspace_id_idx on public.dormspace_likes (dormspace_id);

alter table public.dormspace_likes enable row level security;

drop policy if exists dormspace_likes_select_own on public.dormspace_likes;
create policy dormspace_likes_select_own
  on public.dormspace_likes for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists dormspace_likes_insert_own on public.dormspace_likes;
create policy dormspace_likes_insert_own
  on public.dormspace_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists dormspace_likes_delete_own on public.dormspace_likes;
create policy dormspace_likes_delete_own
  on public.dormspace_likes for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.dormspace_likes is 'User hearts on approved dormspace listings (browse tenants only).';
