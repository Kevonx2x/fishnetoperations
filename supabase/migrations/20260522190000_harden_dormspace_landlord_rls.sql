-- Harden landlord verification and dormspace moderation against direct client writes.

-- The public client-profile policy was created before landlord verification
-- documents moved onto profiles. Keep public client reads, but do not expose
-- rows that now carry landlord-only verification state or storage paths.
drop policy if exists "profiles_select_public_client_role" on public.profiles;
create policy "profiles_select_public_client_role"
  on public.profiles for select
  to anon, authenticated
  using (
    role = 'client'
    and coalesce(is_landlord, false) = false
    and landlord_id_url is null
    and landlord_proof_of_billing_url is null
  );

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
    or coalesce(auth.role(), '') = 'service_role'
    or public.is_admin()
  then
    return new;
  end if;

  -- Preserve the existing self-service onboarding roles, but block direct
  -- escalation into privileged roles such as admin/team_member/landlord.
  if new.role is distinct from old.role
    and new.role not in ('client', 'agent', 'broker')
  then
    raise exception 'Only admins can assign privileged profile roles'
      using errcode = '42501';
  end if;

  if new.is_landlord is distinct from old.is_landlord then
    raise exception 'Only admins can update landlord capability'
      using errcode = '42501';
  end if;

  if new.landlord_id_url is distinct from old.landlord_id_url
    or new.landlord_proof_of_billing_url is distinct from old.landlord_proof_of_billing_url
    or new.landlord_verification_status is distinct from old.landlord_verification_status
    or new.landlord_verification_submitted_at is distinct from old.landlord_verification_submitted_at
    or new.landlord_verification_approved_at is distinct from old.landlord_verification_approved_at
    or new.landlord_verification_approved_by is distinct from old.landlord_verification_approved_by
    or new.landlord_verification_rejection_reason is distinct from old.landlord_verification_rejection_reason
  then
    raise exception 'Only admins can update landlord verification fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

drop policy if exists dormspaces_insert_any on public.dormspaces;
drop policy if exists dormspaces_insert_own_pending_landlord on public.dormspaces;
create policy dormspaces_insert_own_pending_landlord
  on public.dormspaces
  for insert
  to authenticated
  with check (
    landlord_user_id = (select auth.uid())
    and (select public.auth_user_is_landlord())
    and status = 'pending'
    and approved_at is null
    and approved_by is null
  );

drop policy if exists dormspaces_update_own_pending on public.dormspaces;
drop policy if exists dormspaces_update_own_landlord on public.dormspaces;
create policy dormspaces_update_own_landlord
  on public.dormspaces
  for update
  to authenticated
  using (
    landlord_user_id = (select auth.uid())
    and (select public.auth_user_is_landlord())
  )
  with check (
    landlord_user_id = (select auth.uid())
    and (select public.auth_user_is_landlord())
    and status <> 'approved'
    and approved_at is null
    and approved_by is null
  );

drop policy if exists dormspaces_delete_own_landlord on public.dormspaces;
create policy dormspaces_delete_own_landlord
  on public.dormspaces
  for delete
  to authenticated
  using (
    landlord_user_id = (select auth.uid())
    and (select public.auth_user_is_landlord())
  );

drop policy if exists dormspace_photos_insert_any on public.dormspace_photos;
drop policy if exists dormspace_photos_insert_own_landlord on public.dormspace_photos;
create policy dormspace_photos_insert_own_landlord
  on public.dormspace_photos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.dormspaces d
      where d.id = public.dormspace_photos.dormspace_id
        and d.landlord_user_id = (select auth.uid())
        and (select public.auth_user_is_landlord())
        and d.status <> 'approved'
    )
  );

drop policy if exists dormspace_inquiries_select_landlord on public.dormspace_inquiries;
create policy dormspace_inquiries_select_landlord
  on public.dormspace_inquiries
  for select
  to authenticated
  using (
    (select public.auth_user_is_landlord())
    and exists (
      select 1
      from public.dormspaces d
      where d.id = public.dormspace_inquiries.dormspace_id
        and d.landlord_user_id = (select auth.uid())
    )
  );

drop policy if exists dormspace_inquiries_update_landlord on public.dormspace_inquiries;
create policy dormspace_inquiries_update_landlord
  on public.dormspace_inquiries
  for update
  to authenticated
  using (
    (select public.auth_user_is_landlord())
    and exists (
      select 1
      from public.dormspaces d
      where d.id = public.dormspace_inquiries.dormspace_id
        and d.landlord_user_id = (select auth.uid())
    )
  )
  with check (
    (select public.auth_user_is_landlord())
    and exists (
      select 1
      from public.dormspaces d
      where d.id = public.dormspace_inquiries.dormspace_id
        and d.landlord_user_id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
