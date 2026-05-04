-- Allow clients to read viewings for their own leads (dashboard stat tiles + client UI).

drop policy if exists "viewings_select_client" on public.viewings;

create policy "viewings_select_client"
  on public.viewings for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      where l.id = viewings.lead_id
        and l.client_id = auth.uid()
    )
  );
