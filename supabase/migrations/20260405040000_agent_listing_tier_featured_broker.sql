-- Extend listing_tier: featured, broker; align owned caps with product (free: 1, pro/featured: 20, broker: unlimited).

alter table public.agents drop constraint if exists agents_listing_tier_check;

alter table public.agents
  add constraint agents_listing_tier_check
  check (listing_tier in ('free', 'pro', 'featured', 'broker'));

comment on column public.agents.listing_tier is
  'free: 1 owned, 2 co-lists; pro/featured: 20 owned, 10 co-lists; broker: unlimited.';

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
    when 'pro' then 20::bigint
    when 'featured' then 20::bigint
    when 'broker' then 999999999::bigint
    else 1::bigint
  end;
$$;

comment on function public.listing_limit_for_user(uuid) is
  'Max properties a user may own (listed_by) by agents.listing_tier.';
