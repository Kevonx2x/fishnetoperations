-- ---------------------------------------------------------------------------
-- LABEL: Supabase SQL Editor — deal_documents.viewed_by_agent_at
-- Copy/paste into Supabase SQL Editor; same as supabase/migrations/20260428130000_deal_documents_viewed_by_agent_at.sql
-- ---------------------------------------------------------------------------
alter table public.deal_documents
  add column if not exists viewed_by_agent_at timestamptz;

create index if not exists idx_deal_documents_viewed_by_agent_at
  on public.deal_documents (viewed_by_agent_at);
