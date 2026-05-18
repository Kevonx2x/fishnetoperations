-- Rename brokers table → agencies (run in Supabase SQL Editor before deploying app code).
-- Verification queries are included as comments after each section — run SELECTs to confirm.
--
-- NOT renamed (deferred): profiles.role 'broker', agents.listing_tier 'broker',
-- leads.broker_id, notifications.type 'broker_pending_review'.

-- ---------------------------------------------------------------------------
-- 1. Table rename
-- ---------------------------------------------------------------------------
alter table if exists public.brokers rename to agencies;

-- verify: select count(*) as agency_count from public.agencies;

-- ---------------------------------------------------------------------------
-- 2. agents.broker_id → agency_id
-- ---------------------------------------------------------------------------
alter table public.agents rename column broker_id to agency_id;

-- verify: select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'agents' and column_name = 'agency_id';

-- ---------------------------------------------------------------------------
-- 3–4. Junction table (if present in production)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'agent_brokers'
  ) then
    alter table public.agent_brokers rename to agent_agencies;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'agent_agencies' and column_name = 'broker_id'
    ) then
      alter table public.agent_agencies rename column broker_id to agency_id;
    end if;
  end if;
end $$;

-- verify: select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('agent_agencies', 'agent_brokers');

-- ---------------------------------------------------------------------------
-- 5. Storage bucket broker-logos → agency-logos
-- ---------------------------------------------------------------------------
update storage.objects set bucket_id = 'agency-logos' where bucket_id = 'broker-logos';

update storage.buckets
set id = 'agency-logos', name = 'agency-logos'
where id = 'broker-logos';

-- verify: select id, name from storage.buckets where id = 'agency-logos';

-- ---------------------------------------------------------------------------
-- 6. RLS policies on agencies (drop old broker-named policies)
-- ---------------------------------------------------------------------------
drop policy if exists "brokers_select_own_admin_public_approved" on public.agencies;
drop policy if exists "brokers_insert_own" on public.agencies;
drop policy if exists "brokers_update_own_or_admin" on public.agencies;
drop policy if exists "brokers_public_read" on public.agencies;
drop policy if exists "brokers_own_write" on public.agencies;
drop policy if exists "brokers_select_approved" on public.agencies;
drop policy if exists "brokers_own" on public.agencies;
drop policy if exists "brokers_select" on public.agencies;

create policy "agencies_select_own_admin_public_approved"
  on public.agencies for select
  to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or status = 'approved'
    or exists (
      select 1 from public.agents a
      where a.agency_id = agencies.id and a.user_id = auth.uid()
    )
  );

create policy "agencies_insert_own"
  on public.agencies for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "agencies_update_own_or_admin"
  on public.agencies for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "agencies_public_read"
  on public.agencies for select
  using (true);

create policy "agencies_own_write"
  on public.agencies for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- agents policy referencing agencies
drop policy if exists "agents_select_own_admin_broker_team" on public.agents;

create policy "agents_select_own_admin_agency_team"
  on public.agents for select
  to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.agencies b
      where b.id = agency_id and b.user_id = auth.uid()
    )
  );

-- Storage policies
drop policy if exists "broker_logos_public_read" on storage.objects;
drop policy if exists "broker_logos_authenticated_upload" on storage.objects;
drop policy if exists "broker_logos_own_update" on storage.objects;
drop policy if exists "broker_logos_own_delete" on storage.objects;

create policy "agency_logos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'agency-logos');

create policy "agency_logos_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "agency_logos_own_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "agency_logos_own_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- verify: select policyname from pg_policies where tablename = 'agencies';

-- ---------------------------------------------------------------------------
-- 7–8. Functions (new names) + triggers
-- ---------------------------------------------------------------------------

create or replace function public.sync_agency_agent_verified()
returns trigger
language plpgsql
as $$
begin
  new.verified := new.status = 'approved';
  return new;
end;
$$;

create or replace function public.enforce_agency_registration_defaults()
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

create or replace function public.enforce_agency_agent_admin_only_fields()
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

create or replace function public.promote_profile_role_after_agency()
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

create or replace function public.notify_admins_new_agency()
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
    'New agency registration',
    'Review: ' || new.company_name,
    jsonb_build_object('agency_id', new.id, 'company_name', new.company_name, 'email', new.email)
  from public.profiles p
  where p.role = 'admin';
  return new;
end;
$$;

create or replace function public.notify_user_verification_result_agency()
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
      case when new.status = 'approved' then 'Agency verified' else 'Agency registration update' end,
      case
        when new.status = 'approved' then 'Your agency profile is approved and verified.'
        else coalesce(nullif(trim(new.rejection_reason), ''), 'Your agency application was not approved.')
      end,
      jsonb_build_object('agency_id', new.id, 'entity', 'agency', 'status', new.status)
    );
  end if;
  return new;
end;
$$;

-- License expiry batch: keep function name, point at agencies table
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
    from public.agencies b
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
      'Agency license expiring soon',
      format(
        'Your agency license expires on %s (within 30 days). Renew to stay compliant.',
        r.license_expiry
      ),
      jsonb_build_object('entity', 'agency', 'agency_id', r.id, 'license_expiry', r.license_expiry)
    );
    update public.agencies
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

-- Drop old triggers (names may still exist on agencies after table rename)
drop trigger if exists brokers_updated_at on public.agencies;
drop trigger if exists trg_brokers_sync_verified on public.agencies;
drop trigger if exists trg_brokers_registration_defaults on public.agencies;
drop trigger if exists trg_brokers_admin_only on public.agencies;
drop trigger if exists trg_brokers_license_reminder_reset on public.agencies;
drop trigger if exists trg_brokers_promote_role on public.agencies;
drop trigger if exists trg_notify_admins_new_broker on public.agencies;
drop trigger if exists trg_broker_verification_notify on public.agencies;

-- Agents triggers still use shared helpers; re-point agency triggers
create trigger agencies_updated_at
  before update on public.agencies
  for each row execute function public.set_updated_at();

create trigger trg_agencies_sync_verified
  before insert or update on public.agencies
  for each row execute function public.sync_agency_agent_verified();

drop trigger if exists trg_agents_sync_verified on public.agents;
create trigger trg_agents_sync_verified
  before insert or update on public.agents
  for each row execute function public.sync_agency_agent_verified();

create trigger trg_agencies_registration_defaults
  before insert on public.agencies
  for each row execute function public.enforce_agency_registration_defaults();

drop trigger if exists trg_agents_registration_defaults on public.agents;
create trigger trg_agents_registration_defaults
  before insert on public.agents
  for each row execute function public.enforce_agency_registration_defaults();

create trigger trg_agencies_admin_only
  before update on public.agencies
  for each row execute function public.enforce_agency_agent_admin_only_fields();

drop trigger if exists trg_agents_admin_only on public.agents;
create trigger trg_agents_admin_only
  before update on public.agents
  for each row execute function public.enforce_agency_agent_admin_only_fields();

create trigger trg_agencies_license_reminder_reset
  before update on public.agencies
  for each row execute function public.reset_license_expiry_reminder();

drop trigger if exists trg_agents_license_reminder_reset on public.agents;
create trigger trg_agents_license_reminder_reset
  before update on public.agents
  for each row execute function public.reset_license_expiry_reminder();

create trigger trg_agencies_promote_role
  after insert on public.agencies
  for each row execute function public.promote_profile_role_after_agency();

create trigger trg_notify_admins_new_agency
  after insert on public.agencies
  for each row execute function public.notify_admins_new_agency();

create trigger trg_agency_verification_notify
  after update of status, rejection_reason on public.agencies
  for each row execute function public.notify_user_verification_result_agency();

-- Drop superseded functions (after triggers moved)
drop function if exists public.sync_broker_agent_verified();
drop function if exists public.enforce_broker_registration_defaults();
drop function if exists public.enforce_broker_agent_admin_only_fields();
drop function if exists public.promote_profile_role_after_broker();
drop function if exists public.notify_admins_new_broker();
drop function if exists public.notify_user_verification_result_broker();

comment on table public.agencies is 'Agency (brokerage) registration; verified mirrors status = approved';

-- verify: select tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
--   where c.relname = 'agencies' and not t.tgisinternal;
