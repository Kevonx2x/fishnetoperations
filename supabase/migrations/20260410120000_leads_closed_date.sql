-- Track when a lead reached a closed deal (for agent score / closings count).
alter table public.leads add column if not exists closed_date timestamptz;

comment on column public.leads.closed_date is 'Set when deal is closed (pipeline closed); used for agent score closings count.';

update public.leads
set closed_date = coalesce(closed_date, updated_at)
where pipeline_stage = 'closed'
  and closed_date is null;

create index if not exists leads_agent_closed_date_idx on public.leads (agent_id) where closed_date is not null;
