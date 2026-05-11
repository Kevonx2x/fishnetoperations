-- Separate agent-side hiding from client pipeline archive metadata.
alter table public.leads add column if not exists archived_by_agent boolean not null default false;
alter table public.leads add column if not exists archived_by_agent_at timestamptz;

comment on column public.leads.archived_by_agent is 'True when an agent hides the lead from their active pipeline.';
comment on column public.leads.archived_by_agent_at is 'When an agent hid the lead from their active pipeline.';

create index if not exists leads_agent_archived_idx on public.leads (agent_id, archived_by_agent)
  where archived_by_agent = true;
