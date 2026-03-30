-- Phase 1 Batch 1: profiles (roles), leads pipeline, saved_searches, property_matches,
-- notifications, activity_log, RLS, and notification triggers.
--
-- Leads: assumes existing `public.leads.id` is bigint/bigserial (not uuid). New columns are
-- added via ALTER only. `lead_status_history.lead_id` is bigint to match.
--
-- If a previous run created `lead_status_history` with uuid lead_id, run once:
--   drop table if exists public.lead_status_history cascade;
-- then re-apply this migration from the lead_status_history section onward.

-- ---------------------------------------------------------------------------
-- Profiles (linked to auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text,
  avatar_url text,
  role text not null default 'client' check (role in ('admin', 'broker', 'agent', 'client'))
);

create index if not exists profiles_role_idx on public.profiles (role);

comment on table public.profiles is 'App profile; one row per auth user with RBAC role';

-- Auto-create profile on signup (default role client)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    'client'
  );
  return new;
exception
  when unique_violation then
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Leads (pipeline + optional assignment)
-- ---------------------------------------------------------------------------
-- Never create `public.leads` here: production uses bigint/bigserial primary keys.

-- Legacy compatibility: if an old `status` column exists from prior schema, map once
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'status'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'stage'
  ) then
    alter table public.leads rename column status to legacy_status;
    alter table public.leads add column stage text not null default 'new';
    update public.leads set stage = case legacy_status
      when 'new' then 'new'
      when 'contacted' then 'contacted'
      when 'closed' then 'closed_won'
      else 'new'
    end;
  end if;
end $$;

-- Ensure new columns exist when table pre-dates this migration
alter table public.leads add column if not exists stage text;
alter table public.leads add column if not exists source text default 'website';
alter table public.leads add column if not exists agent_id uuid references public.profiles (id) on delete set null;
alter table public.leads add column if not exists broker_id uuid references public.profiles (id) on delete set null;
alter table public.leads add column if not exists client_id uuid references public.profiles (id) on delete set null;
alter table public.leads add column if not exists updated_at timestamptz default now();

update public.leads set stage = 'new' where stage is null;
alter table public.leads alter column stage set default 'new';
alter table public.leads alter column stage set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_stage_check'
  ) then
    alter table public.leads add constraint leads_stage_check check (
      stage in (
        'new', 'contacted', 'qualified', 'viewing', 'negotiation', 'closed_won', 'closed_lost'
      )
    );
  end if;
exception when others then null;
end $$;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create index if not exists leads_stage_idx on public.leads (stage);
create index if not exists leads_email_idx on public.leads (email);

-- ---------------------------------------------------------------------------
-- Lead status history (pipeline audit) — lead_id matches leads.id (bigint)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_lead_stage_history on public.leads;
drop table if exists public.lead_status_history cascade;

create table public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists lead_status_history_lead_id_idx on public.lead_status_history (lead_id);

create or replace function public.lead_stage_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_status_history (lead_id, from_stage, to_stage, changed_by)
    values (new.id, null, new.stage, auth.uid());
  elsif tg_op = 'UPDATE' and (old.stage is distinct from new.stage) then
    insert into public.lead_status_history (lead_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_lead_stage_history
  after insert or update of stage on public.leads
  for each row execute function public.lead_stage_history();

-- ---------------------------------------------------------------------------
-- Saved searches & property matches
-- ---------------------------------------------------------------------------
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}',
  alert_enabled boolean not null default true,
  last_matched_at timestamptz
);

drop trigger if exists saved_searches_updated_at on public.saved_searches;
create trigger saved_searches_updated_at
  before update on public.saved_searches
  for each row execute function public.set_updated_at();

create index if not exists saved_searches_user_id_idx on public.saved_searches (user_id);

create table if not exists public.property_matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  saved_search_id uuid not null references public.saved_searches (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  match_score numeric not null default 1 check (match_score >= 0 and match_score <= 1),
  seen_at timestamptz,
  dismissed_at timestamptz,
  unique (saved_search_id, property_id)
);

create index if not exists property_matches_search_idx on public.property_matches (saved_search_id);
create index if not exists property_matches_property_idx on public.property_matches (property_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('lead_created', 'property_match', 'system')),
  title text not null,
  body text,
  read_at timestamptz,
  metadata jsonb not null default '{}'
);

create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- Notify all admins when a new lead is inserted (public forms)
create or replace function public.notify_admins_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, metadata)
  select
    p.id,
    'lead_created',
    'New lead: ' || coalesce(new.name, 'Unknown'),
    left(coalesce(new.message, new.property_interest, ''), 500),
    jsonb_build_object('lead_id', new.id, 'email', new.email)
  from public.profiles p
  where p.role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_notify_new_lead on public.leads;
create trigger trg_notify_new_lead
  after insert on public.leads
  for each row execute function public.notify_admins_new_lead();

-- Notify search owner when a property match is created
create or replace function public.notify_user_property_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  prop_label text;
begin
  select s.user_id into owner from public.saved_searches s where s.id = new.saved_search_id;
  select p.location into prop_label from public.properties p where p.id = new.property_id;
  if owner is not null then
    insert into public.notifications (user_id, type, title, body, metadata)
    values (
      owner,
      'property_match',
      'New listing match',
      coalesce(prop_label, 'A property matched your saved search'),
      jsonb_build_object(
        'saved_search_id', new.saved_search_id,
        'property_id', new.property_id,
        'property_match_id', new.id,
        'match_score', new.match_score
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_property_match on public.property_matches;
create trigger trg_notify_property_match
  after insert on public.property_matches
  for each row execute function public.notify_user_property_match();

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'
);

-- If activity_log already existed with uuid entity_id, widen for bigint lead ids
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'activity_log'
      and column_name = 'entity_id'
      and (data_type = 'uuid' or udt_name = 'uuid')
  ) then
    alter table public.activity_log
      alter column entity_id type text using entity_id::text;
  end if;
end $$;

create index if not exists activity_log_actor_idx on public.activity_log (actor_id);
create index if not exists activity_log_entity_idx on public.activity_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_status_history enable row level security;
alter table public.saved_searches enable row level security;
alter table public.property_matches enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Leads: public insert (marketing site), read/update for staff
drop policy if exists "leads_insert_anon" on public.leads;
create policy "leads_insert_anon"
  on public.leads for insert
  to anon, authenticated
  with check (true);

drop policy if exists "leads_select_staff" on public.leads;
create policy "leads_select_staff"
  on public.leads for select
  to authenticated
  using (
    public.is_admin()
    or agent_id = auth.uid()
    or broker_id = auth.uid()
    or client_id = auth.uid()
  );

drop policy if exists "leads_update_staff" on public.leads;
create policy "leads_update_staff"
  on public.leads for update
  to authenticated
  using (
    public.is_admin()
    or agent_id = auth.uid()
    or broker_id = auth.uid()
  )
  with check (
    public.is_admin()
    or agent_id = auth.uid()
    or broker_id = auth.uid()
  );

-- Lead history
drop policy if exists "lead_status_history_select_staff" on public.lead_status_history;
create policy "lead_status_history_select_staff"
  on public.lead_status_history for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

-- Saved searches: owner + admin
drop policy if exists "saved_searches_owner" on public.saved_searches;
create policy "saved_searches_owner"
  on public.saved_searches for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Property matches: via saved search ownership
drop policy if exists "property_matches_owner" on public.property_matches;
create policy "property_matches_owner"
  on public.property_matches for all
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.saved_searches s
      where s.id = saved_search_id and s.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.saved_searches s
      where s.id = saved_search_id and s.user_id = auth.uid()
    )
  );

-- Notifications: own rows
drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Activity log: own or admin
drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select"
  on public.activity_log for select
  to authenticated
  using (actor_id = auth.uid() or public.is_admin());

drop policy if exists "activity_log_insert_authenticated" on public.activity_log;
create policy "activity_log_insert_authenticated"
  on public.activity_log for insert
  to authenticated
  with check (actor_id = auth.uid() or public.is_admin());

-- Service role bypasses RLS (Supabase default)
