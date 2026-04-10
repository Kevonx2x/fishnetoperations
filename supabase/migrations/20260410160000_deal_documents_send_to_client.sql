-- Align deal_documents with app columns; track sending copies to clients
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deal_documents' and column_name = 'storage_path'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deal_documents' and column_name = 'file_url'
  ) then
    alter table public.deal_documents rename column storage_path to file_url;
  end if;
end $$;

alter table public.deal_documents add column if not exists agent_id uuid references public.profiles (id) on delete set null;
alter table public.deal_documents add column if not exists file_name text;
alter table public.deal_documents add column if not exists pipeline_stage text;
alter table public.deal_documents add column if not exists notes text;
alter table public.deal_documents add column if not exists sent_to_client boolean not null default false;
alter table public.deal_documents add column if not exists sent_at timestamptz;

comment on column public.deal_documents.sent_to_client is 'Agent shared this deal document with the linked client via notification';
