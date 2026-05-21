-- Landlord verification on profiles (one-time), not per dormspace listing

alter table public.profiles add column if not exists landlord_id_url text;
alter table public.profiles add column if not exists landlord_proof_of_billing_url text;
alter table public.profiles add column if not exists landlord_verification_status text default 'unverified';
alter table public.profiles add column if not exists landlord_verification_submitted_at timestamptz;
alter table public.profiles add column if not exists landlord_verification_approved_at timestamptz;
alter table public.profiles add column if not exists landlord_verification_approved_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists landlord_verification_rejection_reason text;

alter table public.profiles drop constraint if exists profiles_landlord_verification_status_check;
alter table public.profiles
  add constraint profiles_landlord_verification_status_check
  check (
    landlord_verification_status is null
    or landlord_verification_status in ('unverified', 'pending', 'approved', 'rejected')
  );

update public.profiles
set landlord_verification_status = 'unverified'
where landlord_verification_status is null;

-- Backfill from earliest dormspace with ID on file per landlord
update public.profiles p
set
  landlord_id_url = sub.landlord_id_url,
  landlord_proof_of_billing_url = sub.proof_of_billing_url,
  landlord_verification_status = 'pending',
  landlord_verification_submitted_at = sub.created_at
from (
  select distinct on (landlord_user_id)
    landlord_user_id,
    landlord_id_url,
    proof_of_billing_url,
    created_at
  from public.dormspaces
  where landlord_user_id is not null
    and landlord_id_url is not null
  order by landlord_user_id, created_at asc
) sub
where p.id = sub.landlord_user_id
  and p.landlord_id_url is null;

notify pgrst, 'reload schema';
