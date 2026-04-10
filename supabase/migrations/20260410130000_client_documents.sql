-- Client-uploaded documents (IDs, funds proof, visa, etc.) + private storage bucket.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  document_type text not null check (
    document_type in ('valid_id', 'proof_of_funds', 'visa', 'other')
  ),
  file_url text not null,
  file_name text,
  shared_with uuid[] not null default '{}',
  status text not null default 'private' check (status in ('private', 'shared')),
  notes text
);

create unique index if not exists client_documents_client_doc_type_uidx
  on public.client_documents (client_id, document_type);

create index if not exists client_documents_shared_with_idx
  on public.client_documents using gin (shared_with);

alter table public.client_documents enable row level security;

drop policy if exists "client_documents_own_all" on public.client_documents;
create policy "client_documents_own_all"
  on public.client_documents
  for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "client_documents_select_shared" on public.client_documents;
create policy "client_documents_select_shared"
  on public.client_documents
  for select
  using (auth.uid() = any (shared_with));

-- ---------------------------------------------------------------------------
-- Notifications: document_request, document_shared
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;

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
    'deal_pipeline',
    'document_request',
    'document_shared'
  )
);

-- ---------------------------------------------------------------------------
-- Storage: private bucket client-docs — path {client_id}/{document_type}.{ext}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('client-docs', 'client-docs', false)
on conflict (id) do nothing;

drop policy if exists "client_docs_select_own" on storage.objects;
create policy "client_docs_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-docs'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

drop policy if exists "client_docs_insert_own" on storage.objects;
create policy "client_docs_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-docs'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

drop policy if exists "client_docs_update_own" on storage.objects;
create policy "client_docs_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-docs'
    and (storage.foldername (name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'client-docs'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

drop policy if exists "client_docs_delete_own" on storage.objects;
create policy "client_docs_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-docs'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

-- Agents listed in shared_with can read files under that client's prefix
drop policy if exists "client_docs_select_shared_agent" on storage.objects;
create policy "client_docs_select_shared_agent"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-docs'
    and exists (
      select 1
      from public.client_documents cd
      where cd.client_id::text = (storage.foldername (name))[1]
        and auth.uid() = any (cd.shared_with)
    )
  );
