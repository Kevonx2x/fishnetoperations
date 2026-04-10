-- Ordering within pipeline stage + closing notes for deal cards.

alter table public.leads
  add column if not exists pipeline_position integer not null default 0;

alter table public.leads
  add column if not exists closing_notes text;

create index if not exists leads_pipeline_stage_position_idx
  on public.leads (agent_id, pipeline_stage, pipeline_position);
