-- Aligns with supabase/migrations/20260429200000_offers_agreement_reservations_optional_deadline.sql
alter table public.offers
  add column if not exists agreement_file_url text;

alter table public.offers
  add column if not exists client_message text;

alter table public.reservations
  alter column deadline_at drop not null;

alter table public.offers
  add column if not exists agreement_file_name text;

alter table public.reservations
  add column if not exists agreement_file_name text;
