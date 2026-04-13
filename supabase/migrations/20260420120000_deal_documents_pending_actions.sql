-- Support pending pipeline document actions (send/request) before a file exists
alter table public.deal_documents alter column file_url drop not null;

alter table public.deal_documents add column if not exists document_name text;
alter table public.deal_documents add column if not exists direction text;

alter table public.deal_documents drop constraint if exists deal_documents_status_check;
alter table public.deal_documents add constraint deal_documents_status_check
  check (status in ('pending', 'uploaded', 'approved'));

alter table public.deal_documents drop constraint if exists deal_documents_direction_check;
alter table public.deal_documents add constraint deal_documents_direction_check
  check (direction is null or direction in ('sent', 'requested'));
