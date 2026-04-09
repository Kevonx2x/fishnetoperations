-- Agent identity verification: storage paths + document status (separate from approved/verified listing flag)

alter table public.agents
  add column if not exists prc_document_url text,
  add column if not exists selfie_url text,
  add column if not exists verification_status text;

alter table public.agents
  drop constraint if exists agents_verification_status_check;

alter table public.agents
  add constraint agents_verification_status_check
  check (verification_status is null or verification_status in ('pending', 'verified', 'rejected'));

comment on column public.agents.prc_document_url is 'Storage object path in bucket verification (e.g. prc/{user_id}/license.pdf)';
comment on column public.agents.selfie_url is 'Storage object path in bucket verification (e.g. prc/{user_id}/selfie.jpg)';
comment on column public.agents.verification_status is 'PRC/identity verification workflow; null = not submitted';

-- Non-admins cannot self-approve platform status; identity verification status may only
-- become pending (initial submit or resubmit after rejection), not verified.
-- (Agents only — brokers table has no verification_status column.)
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
  if tg_table_name = 'agents' then
    if new.verification_status is distinct from old.verification_status then
      if new.verification_status = 'pending'
         and (old.verification_status is null or old.verification_status = 'rejected') then
        return new;
      end if;
      raise exception 'Only admins can change verification status';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: verification (private; objects under prc/{auth.uid()}/...)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('verification', 'verification', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "verification_select_own" on storage.objects;
create policy "verification_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = 'prc'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "verification_insert_own" on storage.objects;
create policy "verification_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = 'prc'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "verification_update_own" on storage.objects;
create policy "verification_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = 'prc'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = 'prc'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "verification_delete_own" on storage.objects;
create policy "verification_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = 'prc'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
