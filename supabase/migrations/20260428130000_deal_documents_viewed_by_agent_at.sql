-- ---------------------------------------------------------------------------
-- LABEL: Supabase SQL Editor — deal_documents.viewed_by_agent_at
-- Run in Supabase SQL Editor before deploying app code that references this column.
-- ---------------------------------------------------------------------------
alter table public.deal_documents
  add column if not exists viewed_by_agent_at timestamptz;

create index if not exists idx_deal_documents_viewed_by_agent_at
  on public.deal_documents (viewed_by_agent_at);
