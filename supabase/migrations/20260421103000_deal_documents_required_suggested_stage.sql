-- Required document gating metadata + stage grouping for pipeline document flows
alter table public.deal_documents add column if not exists required boolean not null default false;

alter table public.deal_documents add column if not exists suggested_for_stage text;

alter table public.deal_documents drop constraint if exists deal_documents_suggested_for_stage_check;

alter table public.deal_documents add constraint deal_documents_suggested_for_stage_check
  check (
    suggested_for_stage is null
    or suggested_for_stage in ('lead', 'viewing', 'offer', 'reservation', 'closed')
  );
