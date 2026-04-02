-- Fix brokers RLS recursion by using simple public read.

drop policy if exists "brokers_select_approved" on public.brokers;
drop policy if exists "brokers_own" on public.brokers;
drop policy if exists "brokers_select" on public.brokers;

create policy "brokers_public_read" on public.brokers
  for select
  using (true);

create policy "brokers_own_write" on public.brokers
  for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

