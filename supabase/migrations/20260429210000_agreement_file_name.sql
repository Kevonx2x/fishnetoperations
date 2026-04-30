-- Original filename for agent-uploaded agreements (signed download UX).
alter table public.offers
  add column if not exists agreement_file_name text;

alter table public.reservations
  add column if not exists agreement_file_name text;
