-- Agent pipeline stages, deal documents, storage bucket "deals", client notifications.

-- ---------------------------------------------------------------------------
-- Leads: pipeline_stage (separate from legacy `stage` CRM column)
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists pipeline_stage text;

update public.leads
set pipeline_stage = 'lead'
where pipeline_stage is null;

alter table public.leads
  alter column pipeline_stage set default 'lead';

alter table public.leads
  alter column pipeline_stage set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_pipeline_stage_check'
  ) then
    alter table public.leads
      add constraint leads_pipeline_stage_check check (
        pipeline_stage in ('lead', 'viewing', 'offer', 'reservation', 'closed')
      );
  end if;
exception when others then null;
end $$;

create index if not exists leads_pipeline_stage_idx on public.leads (pipeline_stage);

-- ---------------------------------------------------------------------------
-- Pipeline history (optional notes on stage change)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_pipeline_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id bigint not null references public.leads (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  note text,
  changed_by uuid references public.profiles (id) on delete set null
);

create index if not exists lead_pipeline_history_lead_id_idx on public.lead_pipeline_history (lead_id);

alter table public.lead_pipeline_history enable row level security;

drop policy if exists "lead_pipeline_history_select_staff" on public.lead_pipeline_history;
create policy "lead_pipeline_history_select_staff"
  on public.lead_pipeline_history for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

drop policy if exists "lead_pipeline_history_insert_staff" on public.lead_pipeline_history;
create policy "lead_pipeline_history_insert_staff"
  on public.lead_pipeline_history for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Deal documents (per lead + document_type)
-- ---------------------------------------------------------------------------
create table if not exists public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id bigint not null references public.leads (id) on delete cascade,
  document_type text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'approved')),
  storage_path text not null,
  unique (lead_id, document_type)
);

drop trigger if exists deal_documents_updated_at on public.deal_documents;
create trigger deal_documents_updated_at
  before update on public.deal_documents
  for each row execute function public.set_updated_at();

create index if not exists deal_documents_lead_id_idx on public.deal_documents (lead_id);

alter table public.deal_documents enable row level security;

drop policy if exists "deal_documents_select_staff" on public.deal_documents;
create policy "deal_documents_select_staff"
  on public.deal_documents for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

drop policy if exists "deal_documents_insert_staff" on public.deal_documents;
create policy "deal_documents_insert_staff"
  on public.deal_documents for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

drop policy if exists "deal_documents_update_staff" on public.deal_documents;
create policy "deal_documents_update_staff"
  on public.deal_documents for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

drop policy if exists "deal_documents_delete_staff" on public.deal_documents;
create policy "deal_documents_delete_staff"
  on public.deal_documents for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications: deal_pipeline
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;

-- Keep in sync with prior migrations; adds deal_pipeline for client pipeline updates.
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'lead_created',
    'property_match',
    'system',
    'broker_pending_review',
    'agent_pending_review',
    'verification_approved',
    'verification_rejected',
    'license_expiring',
    'co_agent_request',
    'new_lead',
    'viewing_confirmed',
    'viewing_declined',
    'general',
    'team_invite',
    'verification',
    'message',
    'deal_pipeline'
  )
);

-- ---------------------------------------------------------------------------
-- Storage: private bucket deals — object path {lead_id}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('deals', 'deals', false)
on conflict (id) do nothing;

drop policy if exists "deals_storage_select_staff" on storage.objects;
create policy "deals_storage_select_staff"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'deals'
    and exists (
      select 1 from public.leads l
      where l.id::text = (storage.foldername(name))[1]
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

drop policy if exists "deals_storage_insert_staff" on storage.objects;
create policy "deals_storage_insert_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'deals'
    and exists (
      select 1 from public.leads l
      where l.id::text = (storage.foldername(name))[1]
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

drop policy if exists "deals_storage_update_staff" on storage.objects;
create policy "deals_storage_update_staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'deals'
    and exists (
      select 1 from public.leads l
      where l.id::text = (storage.foldername(name))[1]
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  )
  with check (
    bucket_id = 'deals'
    and exists (
      select 1 from public.leads l
      where l.id::text = (storage.foldername(name))[1]
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

drop policy if exists "deals_storage_delete_staff" on storage.objects;
create policy "deals_storage_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'deals'
    and exists (
      select 1 from public.leads l
      where l.id::text = (storage.foldername(name))[1]
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );
