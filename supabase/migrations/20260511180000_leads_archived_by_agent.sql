-- Agent-side soft hide from active pipeline (separate from client `archived_by_client`).
alter table public.leads add column if not exists archived_by_agent boolean not null default false;
alter table public.leads add column if not exists archived_by_agent_at timestamptz;

comment on column public.leads.archived_by_agent is 'When true, the agent hid this lead from their active pipeline (still queryable for admin/support).';
comment on column public.leads.archived_by_agent_at is 'Timestamp when the agent archived the lead from their view.';

create index if not exists leads_agent_archived_agent_idx
  on public.leads (agent_id, archived_by_agent)
  where archived_by_agent = true;
