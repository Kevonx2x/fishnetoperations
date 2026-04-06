-- Clients must be able to insert viewing requests for the listing agent on a property.
-- Existing policy only allowed agent_user_id = auth.uid() (agent inserting for self).

drop policy if exists "viewing_requests_insert_own" on public.viewing_requests;

create policy "viewing_requests_insert_as_listing_agent"
  on public.viewing_requests for insert
  to authenticated
  with check (agent_user_id = auth.uid());

create policy "viewing_requests_insert_as_client_for_property"
  on public.viewing_requests for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = viewing_requests.property_id
        and (
          p.listed_by = viewing_requests.agent_user_id
          or exists (
            select 1
            from public.property_agents pa
            inner join public.agents a on a.id = pa.agent_id
            where pa.property_id = p.id
              and a.user_id = viewing_requests.agent_user_id
          )
        )
    )
  );
