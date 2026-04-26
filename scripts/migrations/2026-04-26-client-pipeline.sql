-- Client pipeline (CEO review): allow clients to read/update deal_documents on their own leads,
-- and to read/write objects in the private `deals` bucket under folders named by lead id they own.
-- App currently uses service-role API routes for pipeline data; these policies enable a future
-- client-side Supabase path or debugging without weakening staff policies.

-- ---------------------------------------------------------------------------
-- deal_documents: client SELECT + UPDATE on own leads
-- ---------------------------------------------------------------------------
drop policy if exists "deal_documents_select_client" on public.deal_documents;
create policy "deal_documents_select_client"
  on public.deal_documents for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and l.client_id is not null
        and l.client_id = auth.uid()
    )
  );

drop policy if exists "deal_documents_update_client" on public.deal_documents;
create policy "deal_documents_update_client"
  on public.deal_documents for update to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and l.client_id is not null
        and l.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and l.client_id is not null
        and l.client_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket `deals`: client read/write under their lead id folder
-- ---------------------------------------------------------------------------
drop policy if exists "deals_storage_select_client" on storage.objects;
create policy "deals_storage_select_client"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'deals'
    and exists (
      select 1 from public.leads l
      where l.id::text = (storage.foldername(name))[1]
        and l.client_id is not null
        and l.client_id = auth.uid()
    )
  );

drop policy if exists "deals_storage_insert_client" on storage.objects;
create policy "deals_storage_insert_client"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deals'
    and exists (
      select 1 from public.leads l
      where l.id::text = (storage.foldername(name))[1]
        and l.client_id is not null
        and l.client_id = auth.uid()
    )
  );

drop policy if exists "deals_storage_update_client" on storage.objects;
create policy "deals_storage_update_client"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'deals'
    and exists (
      select 1 from public.leads l
      where l.id::text = (storage.foldername(name))[1]
        and l.client_id is not null
        and l.client_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'deals'
    and exists (
      select 1 from public.leads l
      where l.id::text = (storage.foldername(name))[1]
        and l.client_id is not null
        and l.client_id = auth.uid()
    )
  );
