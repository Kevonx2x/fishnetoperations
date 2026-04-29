-- ---------------------------------------------------------------------------
-- LABEL: Supabase SQL Editor — Pro tier owned cap: 10 (listing_limit_for_user)
-- Same as supabase/migrations/20260429120000_listing_limit_pro_ten_owned.sql
-- ---------------------------------------------------------------------------
create or replace function public.listing_limit_for_user(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce(
    (select a.listing_tier from public.agents a where a.user_id = p_user_id limit 1),
    'free'
  )
    when 'free' then 1::bigint
    when 'pro' then 10::bigint
    when 'featured' then 20::bigint
    when 'broker' then 999999999::bigint
    else 1::bigint
  end;
$$;

comment on function public.listing_limit_for_user(uuid) is
  'Max properties a user may own (listed_by) by agents.listing_tier: free 1, pro 10, featured 20, broker unlimited.';

comment on column public.agents.listing_tier is
  'free: 1 owned, 2 co-lists; pro: 10 owned, 10 co-lists; featured: 20 owned, 10 co-lists; broker: unlimited.';
