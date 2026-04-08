-- Allow listing owners (and co-listed agents) to read saved_properties rows for their listings.
-- Enables free-tier agents to see when a specific client pinned one of their properties on /clients/[id].

drop policy if exists "saved_properties_select_agent_own_listing_pins" on public.saved_properties;

create policy "saved_properties_select_agent_own_listing_pins"
  on public.saved_properties for select
  to authenticated
  using (
    exists (
      select 1
      from public.properties p
      where p.id = saved_properties.property_id
        and p.listed_by = auth.uid()
    )
    or exists (
      select 1
      from public.property_agents pa
      inner join public.agents a on a.id = pa.agent_id
      where pa.property_id = saved_properties.property_id
        and a.user_id = auth.uid()
    )
  );

comment on policy "saved_properties_select_agent_own_listing_pins" on public.saved_properties is
  'Listing owner or co-agent can read save rows for their properties (for client wishlist preview).';
