-- Allow listing owners to add themselves to property_agents when they create a listing.
drop policy if exists "property_agents_insert_listing_owner" on public.property_agents;

create policy "property_agents_insert_listing_owner"
  on public.property_agents for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.properties p
      inner join public.agents a on a.id = property_agents.agent_id
      where p.id = property_agents.property_id
        and p.listed_by = auth.uid()
        and a.user_id = auth.uid()
    )
    or public.is_admin()
  );
