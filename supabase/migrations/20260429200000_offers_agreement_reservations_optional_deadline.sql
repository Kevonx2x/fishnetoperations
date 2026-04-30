-- Document-first offers: store uploaded agreement path + optional client message.
alter table public.offers
  add column if not exists agreement_file_url text;

alter table public.offers
  add column if not exists client_message text;

-- Reservations: deadline/refund live in uploaded agreement; allow null for new rows.
alter table public.reservations
  alter column deadline_at drop not null;
