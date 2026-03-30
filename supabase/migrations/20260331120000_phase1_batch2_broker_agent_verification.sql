-- Phase 1 Batch 2: broker & agent verification, license expiry reminders, storage for logos.
--
-- Optional: schedule license checks in Supabase SQL (enable pg_cron if available):
--   select cron.schedule(
--     'license-expiry-reminders',
--     '0 7 * * *',
--     $$ select public.run_license_expiry_notifications(); $$
--   );

-- ---------------------------------------------------------------------------
-- Notification types (extend batch 1 check)
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
    'license_expiring'
  )
);

-- ---------------------------------------------------------------------------
-- Brokers
-- ---------------------------------------------------------------------------
create table if not exists public.brokers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  company_name text not null,
  license_number text not null,
  license_expiry date,
  phone text,
  email text not null,
  website text,
  logo_url text,
  bio text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  verified boolean not null default false,
  rejection_reason text,
  license_expiry_reminder_sent_at timestamptz,
  user_id uuid not null references public.profiles (id) on delete cascade,
  unique (user_id)
);

create index if not exists brokers_status_idx on public.brokers (status);
create index if not exists brokers_user_id_idx on public.brokers (user_id);

drop trigger if exists brokers_updated_at on public.brokers;
create trigger brokers_updated_at
  before update on public.brokers
  for each row execute function public.set_updated_at();

comment on table public.brokers is 'Brokerage registration; verified mirrors status = approved';

-- ---------------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------------
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  image_url text,
  bio text,
  license_number text not null,
  license_expiry date,
  score numeric not null default 0,
  closings integer not null default 0,
  response_time text,
  availability text,
  broker_id uuid references public.brokers (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  verified boolean not null default false,
  rejection_reason text,
  license_expiry_reminder_sent_at timestamptz,
  user_id uuid not null references public.profiles (id) on delete cascade,
  unique (user_id)
);

create index if not exists agents_status_idx on public.agents (status);
create index if not exists agents_user_id_idx on public.agents (user_id);
create index if not exists agents_broker_id_idx on public.agents (broker_id);

drop trigger if exists agents_updated_at on public.agents;
create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

comment on table public.agents is 'Agent registration; verified mirrors status = approved';

-- ---------------------------------------------------------------------------
-- Verification: verified flag follows status; only approved is verified
-- ---------------------------------------------------------------------------
create or replace function public.sync_broker_agent_verified()
returns trigger
language plpgsql
as $$
begin
  new.verified := new.status = 'approved';
  return new;
end;
$$;

drop trigger if exists trg_brokers_sync_verified on public.brokers;
create trigger trg_brokers_sync_verified
  before insert or update on public.brokers
  for each row execute function public.sync_broker_agent_verified();

drop trigger if exists trg_agents_sync_verified on public.agents;
create trigger trg_agents_sync_verified
  before insert or update on public.agents
  for each row execute function public.sync_broker_agent_verified();

-- ---------------------------------------------------------------------------
-- Non-admins: submissions stay pending; cannot self-approve
-- ---------------------------------------------------------------------------
create or replace function public.enforce_broker_registration_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.status := 'pending';
  new.verified := false;
  new.rejection_reason := null;
  return new;
end;
$$;

drop trigger if exists trg_brokers_registration_defaults on public.brokers;
create trigger trg_brokers_registration_defaults
  before insert on public.brokers
  for each row execute function public.enforce_broker_registration_defaults();

drop trigger if exists trg_agents_registration_defaults on public.agents;
create trigger trg_agents_registration_defaults
  before insert on public.agents
  for each row execute function public.enforce_broker_registration_defaults();

create or replace function public.enforce_broker_agent_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.verified is distinct from old.verified
     or new.user_id is distinct from old.user_id
     or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Only admins can change verification or assignment fields';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_brokers_admin_only on public.brokers;
create trigger trg_brokers_admin_only
  before update on public.brokers
  for each row execute function public.enforce_broker_agent_admin_only_fields();

drop trigger if exists trg_agents_admin_only on public.agents;
create trigger trg_agents_admin_only
  before update on public.agents
  for each row execute function public.enforce_broker_agent_admin_only_fields();

-- ---------------------------------------------------------------------------
-- Reset one-time license reminder when expiry date changes
-- ---------------------------------------------------------------------------
create or replace function public.reset_license_expiry_reminder()
returns trigger
language plpgsql
as $$
begin
  if new.license_expiry is distinct from old.license_expiry then
    new.license_expiry_reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_brokers_license_reminder_reset on public.brokers;
create trigger trg_brokers_license_reminder_reset
  before update on public.brokers
  for each row execute function public.reset_license_expiry_reminder();

drop trigger if exists trg_agents_license_reminder_reset on public.agents;
create trigger trg_agents_license_reminder_reset
  before update on public.agents
  for each row execute function public.reset_license_expiry_reminder();

-- ---------------------------------------------------------------------------
-- Promote profile role on registration
-- ---------------------------------------------------------------------------
create or replace function public.promote_profile_role_after_broker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set role = 'broker'
  where id = new.user_id and role = 'client';
  return new;
end;
$$;

drop trigger if exists trg_brokers_promote_role on public.brokers;
create trigger trg_brokers_promote_role
  after insert on public.brokers
  for each row execute function public.promote_profile_role_after_broker();

create or replace function public.promote_profile_role_after_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set role = 'agent'
  where id = new.user_id and role = 'client';
  return new;
end;
$$;

drop trigger if exists trg_agents_promote_role on public.agents;
create trigger trg_agents_promote_role
  after insert on public.agents
  for each row execute function public.promote_profile_role_after_agent();

-- ---------------------------------------------------------------------------
-- Admin notifications: pending broker/agent applications
-- ---------------------------------------------------------------------------
create or replace function public.notify_admins_new_broker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, metadata)
  select
    p.id,
    'broker_pending_review',
    'New broker registration',
    'Review: ' || new.company_name,
    jsonb_build_object('broker_id', new.id, 'company_name', new.company_name, 'email', new.email)
  from public.profiles p
  where p.role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_notify_admins_new_broker on public.brokers;
create trigger trg_notify_admins_new_broker
  after insert on public.brokers
  for each row execute function public.notify_admins_new_broker();

create or replace function public.notify_admins_new_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, metadata)
  select
    p.id,
    'agent_pending_review',
    'New agent registration',
    'Review: ' || new.name,
    jsonb_build_object('agent_id', new.id, 'name', new.name, 'email', new.email)
  from public.profiles p
  where p.role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_notify_admins_new_agent on public.agents;
create trigger trg_notify_admins_new_agent
  after insert on public.agents
  for each row execute function public.notify_admins_new_agent();

-- ---------------------------------------------------------------------------
-- Notify broker/agent when admin approves or rejects
-- ---------------------------------------------------------------------------
create or replace function public.notify_user_verification_result_broker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, metadata)
    values (
      new.user_id,
      case when new.status = 'approved' then 'verification_approved' else 'verification_rejected' end,
      case when new.status = 'approved' then 'Broker verified' else 'Broker registration update' end,
      case
        when new.status = 'approved' then 'Your brokerage profile is approved and verified.'
        else coalesce(nullif(trim(new.rejection_reason), ''), 'Your broker application was not approved.')
      end,
      jsonb_build_object('broker_id', new.id, 'entity', 'broker', 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_broker_verification_notify on public.brokers;
create trigger trg_broker_verification_notify
  after update of status, rejection_reason on public.brokers
  for each row execute function public.notify_user_verification_result_broker();

create or replace function public.notify_user_verification_result_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, metadata)
    values (
      new.user_id,
      case when new.status = 'approved' then 'verification_approved' else 'verification_rejected' end,
      case when new.status = 'approved' then 'Agent verified' else 'Agent registration update' end,
      case
        when new.status = 'approved' then 'Your agent profile is approved and verified.'
        else coalesce(nullif(trim(new.rejection_reason), ''), 'Your agent application was not approved.')
      end,
      jsonb_build_object('agent_id', new.id, 'entity', 'agent', 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agent_verification_notify on public.agents;
create trigger trg_agent_verification_notify
  after update of status, rejection_reason on public.agents
  for each row execute function public.notify_user_verification_result_agent();

-- ---------------------------------------------------------------------------
-- License expiry: batch job inserts one notification per row in 30-day window
-- ---------------------------------------------------------------------------
create or replace function public.run_license_expiry_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select b.id, b.user_id, b.company_name as label, b.license_expiry
    from public.brokers b
    where b.status = 'approved'
      and b.license_expiry is not null
      and b.license_expiry > (current_timestamp at time zone 'utc')::date
      and b.license_expiry <= (current_timestamp at time zone 'utc')::date + interval '30 days'
      and b.license_expiry_reminder_sent_at is null
  loop
    insert into public.notifications (user_id, type, title, body, metadata)
    values (
      r.user_id,
      'license_expiring',
      'Broker license expiring soon',
      format(
        'Your brokerage license expires on %s (within 30 days). Renew to stay compliant.',
        r.license_expiry
      ),
      jsonb_build_object('entity', 'broker', 'broker_id', r.id, 'license_expiry', r.license_expiry)
    );
    update public.brokers
    set license_expiry_reminder_sent_at = now()
    where id = r.id;
  end loop;

  for r in
    select a.id, a.user_id, a.name as label, a.license_expiry
    from public.agents a
    where a.status = 'approved'
      and a.license_expiry is not null
      and a.license_expiry > (current_timestamp at time zone 'utc')::date
      and a.license_expiry <= (current_timestamp at time zone 'utc')::date + interval '30 days'
      and a.license_expiry_reminder_sent_at is null
  loop
    insert into public.notifications (user_id, type, title, body, metadata)
    values (
      r.user_id,
      'license_expiring',
      'Agent license expiring soon',
      format(
        'Your agent license expires on %s (within 30 days). Renew to stay compliant.',
        r.license_expiry
      ),
      jsonb_build_object('entity', 'agent', 'agent_id', r.id, 'license_expiry', r.license_expiry)
    );
    update public.agents
    set license_expiry_reminder_sent_at = now()
    where id = r.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.brokers enable row level security;
alter table public.agents enable row level security;

drop policy if exists "brokers_select_own_admin_public_approved" on public.brokers;
create policy "brokers_select_own_admin_public_approved"
  on public.brokers for select
  to anon, authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or (status = 'approved' and verified = true)
    or exists (
      select 1 from public.agents a
      where a.broker_id = brokers.id and a.user_id = auth.uid()
    )
  );

drop policy if exists "brokers_insert_own" on public.brokers;
create policy "brokers_insert_own"
  on public.brokers for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "brokers_update_own_or_admin" on public.brokers;
create policy "brokers_update_own_or_admin"
  on public.brokers for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "agents_select_own_admin_broker_team" on public.agents;
create policy "agents_select_own_admin_broker_team"
  on public.agents for select
  to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.brokers b
      where b.id = broker_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "agents_insert_own" on public.agents;
create policy "agents_insert_own"
  on public.agents for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "agents_update_own_or_admin" on public.agents;
create policy "agents_update_own_or_admin"
  on public.agents for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: broker logos (public read; upload to folder = auth uid)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('broker-logos', 'broker-logos', true)
on conflict (id) do nothing;

drop policy if exists "broker_logos_public_read" on storage.objects;
create policy "broker_logos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'broker-logos');

drop policy if exists "broker_logos_authenticated_upload" on storage.objects;
create policy "broker_logos_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'broker-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "broker_logos_own_update" on storage.objects;
create policy "broker_logos_own_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'broker-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'broker-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "broker_logos_own_delete" on storage.objects;
create policy "broker_logos_own_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'broker-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
