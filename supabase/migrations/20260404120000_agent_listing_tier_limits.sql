-- Listing limits: free (3) vs pro (20). Tier on agents; enforced in RLS on property insert.

alter table public.agents
  add column if not exists listing_tier text not null default 'free'
  check (listing_tier in ('free', 'pro'));

comment on column public.agents.listing_tier is 'free: 3 listings; pro: 20. Set to pro when subscription is active (manual or billing integration).';

create or replace function public.listing_limit_for_user(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce(
    (select a.listing_tier from public.agents a where a.user_id = p_user_id limit 1),
    'free'
  )
    when 'pro' then 20
    else 3
  end;
$$;

comment on function public.listing_limit_for_user(uuid) is 'Max properties a user may list (by agents.listing_tier).';

grant execute on function public.listing_limit_for_user(uuid) to authenticated;

drop policy if exists "properties_insert_listing_owner" on public.properties;
create policy "properties_insert_listing_owner"
  on public.properties for insert
  to authenticated
  with check (
    listed_by = auth.uid()
    and (
      select count(*)::bigint from public.properties p where p.listed_by = auth.uid()
    ) < public.listing_limit_for_user(auth.uid())::bigint
  );
