-- Allow identity verification status 'suspended' (admin action)

alter table public.agents drop constraint if exists agents_verification_status_check;

alter table public.agents add constraint agents_verification_status_check check (
  verification_status is null
  or verification_status in ('pending', 'verified', 'rejected', 'suspended')
);
