-- Agent follow: junction table, agent notification prefs, follow notifications

-- ---------------------------------------------------------------------------
-- agents: notification_preferences (e.g. following alerts)
-- ---------------------------------------------------------------------------
alter table public.agents add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

update public.agents
set notification_preferences =
  coalesce(notification_preferences, '{}'::jsonb)
  || jsonb_build_object('following', false)
where not (coalesce(notification_preferences, '{}'::jsonb) ? 'following');

alter table public.agents alter column notification_preferences set default '{"following": false}'::jsonb;

comment on column public.agents.notification_preferences is 'Agent opt-ins for client-driven alerts; following=true sends when a client follows';

-- ---------------------------------------------------------------------------
-- agent_followers
-- ---------------------------------------------------------------------------
create table if not exists public.agent_followers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  unique (client_id, agent_id)
);

create index if not exists agent_followers_agent_id_idx on public.agent_followers (agent_id);
create index if not exists agent_followers_client_id_idx on public.agent_followers (client_id);

alter table public.agent_followers enable row level security;

drop policy if exists "agent_followers_select_public" on public.agent_followers;
create policy "agent_followers_select_public"
  on public.agent_followers for select
  to anon, authenticated
  using (true);

drop policy if exists "agent_followers_insert_client" on public.agent_followers;
create policy "agent_followers_insert_client"
  on public.agent_followers for insert
  to authenticated
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'client'
    )
  );

drop policy if exists "agent_followers_delete_own" on public.agent_followers;
create policy "agent_followers_delete_own"
  on public.agent_followers for delete
  to authenticated
  using (client_id = auth.uid());

comment on table public.agent_followers is 'Clients following agents for feed + counts';

-- ---------------------------------------------------------------------------
-- notifications: agent_followed
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
    'client_feed_viewing',
    'signup',
    'agent_followed'
  )
);

-- ---------------------------------------------------------------------------
-- Notify agent when followed (only if agents.notification_preferences.following is true)
-- ---------------------------------------------------------------------------
create or replace function public.notify_agent_on_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs jsonb;
  v_agent_user_id uuid;
  v_client_name text;
begin
  select a.user_id, coalesce(a.notification_preferences, '{}'::jsonb)
  into v_agent_user_id, v_prefs
  from public.agents a
  where a.id = new.agent_id;

  if v_agent_user_id is null then
    return new;
  end if;

  if coalesce((v_prefs->>'following')::boolean, false) is distinct from true then
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'A client')
  into v_client_name
  from public.profiles p
  where p.id = new.client_id;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    v_agent_user_id,
    'agent_followed',
    'New follower',
    coalesce(v_client_name, 'A client') || ' started following you.',
    jsonb_build_object('client_id', new.client_id, 'agent_id', new.agent_id)
  );

  return new;
end;
$$;

drop trigger if exists trg_agent_followers_notify on public.agent_followers;
create trigger trg_agent_followers_notify
  after insert on public.agent_followers
  for each row execute function public.notify_agent_on_new_follower();
