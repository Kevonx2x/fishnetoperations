-- Client mobile dashboard: badges, display theme, activity notifications, check_and_award_badges RPC.

-- ---------------------------------------------------------------------------
-- profiles.display_theme (client preference for mobile dashboard)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists display_theme text not null default 'dark'
  check (display_theme in ('dark', 'light'));

comment on column public.profiles.display_theme is 'BahayGo mobile client UI theme: dark | light';

-- ---------------------------------------------------------------------------
-- client_badges
-- ---------------------------------------------------------------------------
create table if not exists public.client_badges (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  badge_slug text not null check (
    badge_slug in ('first-save', 'smart-shopper', 'active-hunter', 'early-adopter', 'document-ready')
  ),
  earned_at timestamptz not null default now(),
  unique (client_id, badge_slug)
);

create index if not exists client_badges_client_id_idx on public.client_badges (client_id);

alter table public.client_badges enable row level security;

drop policy if exists "client_badges_select_own" on public.client_badges;
create policy "client_badges_select_own"
  on public.client_badges for select
  to authenticated
  using (client_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications: new feed types
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check check (
  type in (
    'lead_created',
    'property_match',
    'system',
    'broker_pending_review',
    'agent_pending_review',
    'verification_approved',
    'verification_rejected',
    'license_expiring',
    'co_agent_request',
    'new_lead',
    'viewing_confirmed',
    'viewing_declined',
    'general',
    'team_invite',
    'verification',
    'message',
    'deal_pipeline',
    'document_request',
    'document_shared',
    'listing_expiry',
    'deal_declined',
    'client_feed_property_like',
    'client_feed_property_save',
    'client_feed_price_drop',
    'client_feed_badge',
    'client_feed_viewing'
  )
);

-- ---------------------------------------------------------------------------
-- check_and_award_badges
-- ---------------------------------------------------------------------------
create or replace function public.check_and_award_badges(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  save_count int;
  viewing_count int;
  doc_count int;
  created_ts timestamptz;
begin
  if p_client_id is null then
    return;
  end if;

  select p.created_at into created_ts from public.profiles p where p.id = p_client_id;
  select count(*)::int into save_count from public.saved_properties where user_id = p_client_id;
  select count(*)::int into viewing_count from public.viewing_requests where client_user_id = p_client_id;
  select count(*)::int into doc_count from public.client_documents where client_id = p_client_id;

  if save_count >= 1 then
    insert into public.client_badges (client_id, badge_slug, earned_at)
    values (p_client_id, 'first-save', now())
    on conflict (client_id, badge_slug) do nothing;
  end if;

  if save_count >= 5 then
    insert into public.client_badges (client_id, badge_slug, earned_at)
    values (p_client_id, 'smart-shopper', now())
    on conflict (client_id, badge_slug) do nothing;
  end if;

  if viewing_count >= 3 then
    insert into public.client_badges (client_id, badge_slug, earned_at)
    values (p_client_id, 'active-hunter', now())
    on conflict (client_id, badge_slug) do nothing;
  end if;

  if created_ts is not null and created_ts < '2027-01-01'::timestamptz then
    insert into public.client_badges (client_id, badge_slug, earned_at)
    values (p_client_id, 'early-adopter', created_ts)
    on conflict (client_id, badge_slug) do nothing;
  end if;

  if doc_count >= 3 then
    insert into public.client_badges (client_id, badge_slug, earned_at)
    values (p_client_id, 'document-ready', now())
    on conflict (client_id, badge_slug) do nothing;
  end if;
end;
$$;

grant execute on function public.check_and_award_badges(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Notify listing owner when someone likes a listing
-- ---------------------------------------------------------------------------
create or replace function public.notify_listing_owner_on_property_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  prop_name text;
  prop_img text;
  actor_name text;
  actor_avatar text;
  actor_phone text;
begin
  select p.listed_by, coalesce(nullif(trim(p.name), ''), p.location), p.image_url
  into owner, prop_name, prop_img
  from public.properties p
  where p.id = new.property_id;

  if owner is null or owner = new.user_id then
    return new;
  end if;

  select pr.full_name, pr.avatar_url, pr.phone
  into actor_name, actor_avatar, actor_phone
  from public.profiles pr
  where pr.id = new.user_id;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    owner,
    'client_feed_property_like',
    'Someone liked your listing',
    coalesce(nullif(trim(actor_name), ''), 'Someone') || ' liked your property',
    jsonb_build_object(
      'feed_kind', 'property_like',
      'actor_id', new.user_id,
      'actor_name', actor_name,
      'actor_avatar_url', actor_avatar,
      'actor_phone', actor_phone,
      'property_id', new.property_id,
      'property_name', coalesce(nullif(trim(prop_name), ''), 'Your listing'),
      'property_image_url', prop_img
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_listing_owner_property_like on public.property_likes;
create trigger trg_notify_listing_owner_property_like
  after insert on public.property_likes
  for each row execute function public.notify_listing_owner_on_property_like();

-- ---------------------------------------------------------------------------
-- Notify listing owner when someone saves (pins) a listing
-- ---------------------------------------------------------------------------
create or replace function public.notify_listing_owner_on_property_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  prop_name text;
  prop_img text;
  actor_name text;
  actor_avatar text;
  actor_phone text;
begin
  select p.listed_by, coalesce(nullif(trim(p.name), ''), p.location), p.image_url
  into owner, prop_name, prop_img
  from public.properties p
  where p.id = new.property_id;

  if owner is null or owner = new.user_id then
    return new;
  end if;

  select pr.full_name, pr.avatar_url, pr.phone
  into actor_name, actor_avatar, actor_phone
  from public.profiles pr
  where pr.id = new.user_id;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    owner,
    'client_feed_property_save',
    'Someone saved your listing',
    coalesce(nullif(trim(actor_name), ''), 'Someone') || ' saved your property',
    jsonb_build_object(
      'feed_kind', 'property_save',
      'actor_id', new.user_id,
      'actor_name', actor_name,
      'actor_avatar_url', actor_avatar,
      'actor_phone', actor_phone,
      'property_id', new.property_id,
      'property_name', coalesce(nullif(trim(prop_name), ''), 'Your listing'),
      'property_image_url', prop_img
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_listing_owner_property_save on public.saved_properties;
create trigger trg_notify_listing_owner_property_save
  after insert on public.saved_properties
  for each row execute function public.notify_listing_owner_on_property_save();

-- ---------------------------------------------------------------------------
-- Price drop: notify users who saved the property
-- ---------------------------------------------------------------------------
create or replace function public.notify_saved_users_price_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.price is not distinct from new.price then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, metadata)
  select
    s.user_id,
    'client_feed_price_drop',
    'Price update',
    'A property you saved changed price',
    jsonb_build_object(
      'feed_kind', 'price_drop',
      'property_id', new.id,
      'property_name', coalesce(nullif(trim(new.name), ''), new.location),
      'property_image_url', new.image_url,
      'old_price', old.price::text,
      'new_price', new.price::text
    )
  from public.saved_properties s
  where s.property_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_notify_price_drop on public.properties;
create trigger trg_notify_price_drop
  after update of price on public.properties
  for each row execute function public.notify_saved_users_price_drop();

-- ---------------------------------------------------------------------------
-- Viewing request: notify client (feed)
-- ---------------------------------------------------------------------------
create or replace function public.notify_client_viewing_request_feed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  agent_name text;
  agent_avatar text;
  prop_name text;
  prop_img text;
begin
  if new.client_user_id is null then
    return new;
  end if;

  select pr.full_name, pr.avatar_url
  into agent_name, agent_avatar
  from public.profiles pr
  where pr.id = new.agent_user_id;

  if new.property_id is not null then
    select coalesce(nullif(trim(p.name), ''), p.location), p.image_url
    into prop_name, prop_img
    from public.properties p
    where p.id = new.property_id;
  else
    prop_name := 'General viewing request';
    prop_img := null;
  end if;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    new.client_user_id,
    'client_feed_viewing',
    'Viewing request',
    'Your viewing request was sent to ' || coalesce(nullif(trim(agent_name), ''), 'the agent'),
    jsonb_build_object(
      'feed_kind', 'viewing_request',
      'agent_user_id', new.agent_user_id,
      'agent_name', agent_name,
      'agent_avatar_url', agent_avatar,
      'property_id', new.property_id,
      'property_name', coalesce(nullif(trim(prop_name), ''), 'Listing'),
      'property_image_url', prop_img,
      'status', new.status
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_client_viewing_feed on public.viewing_requests;
create trigger trg_notify_client_viewing_feed
  after insert on public.viewing_requests
  for each row execute function public.notify_client_viewing_request_feed();

-- ---------------------------------------------------------------------------
-- Badge earned notification
-- ---------------------------------------------------------------------------
create or replace function public.notify_client_badge_earned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b_title text;
  b_body text;
begin
  b_title := case new.badge_slug
    when 'first-save' then 'First Save'
    when 'smart-shopper' then 'Smart Shopper'
    when 'active-hunter' then 'Active Hunter'
    when 'early-adopter' then 'Early Adopter'
    when 'document-ready' then 'Document Ready'
    else initcap(replace(new.badge_slug, '-', ' '))
  end;

  b_body := case new.badge_slug
    when 'first-save' then 'You saved your first property.'
    when 'smart-shopper' then 'You saved 5 or more listings.'
    when 'active-hunter' then 'You booked 3 viewing requests.'
    when 'early-adopter' then 'Thanks for joining BahayGo early.'
    when 'document-ready' then 'You uploaded 3 documents.'
    else 'You earned a new badge.'
  end;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    new.client_id,
    'client_feed_badge',
    'Badge earned',
    b_body,
    jsonb_build_object(
      'feed_kind', 'badge_earned',
      'badge_slug', new.badge_slug,
      'badge_name', b_title,
      'badge_description', b_body
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_badge_earned on public.client_badges;
create trigger trg_notify_badge_earned
  after insert on public.client_badges
  for each row execute function public.notify_client_badge_earned();

-- ---------------------------------------------------------------------------
-- Triggers: call check_and_award_badges after relevant inserts
-- ---------------------------------------------------------------------------
create or replace function public.trg_check_badges_after_saved_property()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_and_award_badges(new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_badges_saved_property on public.saved_properties;
create trigger trg_badges_saved_property
  after insert on public.saved_properties
  for each row execute function public.trg_check_badges_after_saved_property();

create or replace function public.trg_check_badges_after_viewing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_user_id is not null then
    perform public.check_and_award_badges(new.client_user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_badges_viewing on public.viewing_requests;
create trigger trg_badges_viewing
  after insert on public.viewing_requests
  for each row execute function public.trg_check_badges_after_viewing();

create or replace function public.trg_check_badges_after_client_doc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_and_award_badges(new.client_id);
  return new;
end;
$$;

drop trigger if exists trg_badges_client_doc on public.client_documents;
create trigger trg_badges_client_doc
  after insert on public.client_documents
  for each row execute function public.trg_check_badges_after_client_doc();

create or replace function public.trg_check_badges_after_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_and_award_badges(new.id);
  return new;
end;
$$;

drop trigger if exists trg_badges_profile_insert on public.profiles;
create trigger trg_badges_profile_insert
  after insert on public.profiles
  for each row execute function public.trg_check_badges_after_profile_insert();
