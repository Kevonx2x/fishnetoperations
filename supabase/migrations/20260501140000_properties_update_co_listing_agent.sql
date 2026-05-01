-- Allow co-listing agents (property_agents) to update a property they did not list,
-- while keeping listed_by immutable via WITH CHECK against the pre-update row.

drop policy if exists "properties_update_co_listing_agent" on public.properties;

create policy "properties_update_co_listing_agent"
  on public.properties for update
  to authenticated
  using (
    listed_by is distinct from auth.uid()
    and exists (
      select 1
      from public.property_agents pa
      inner join public.agents a on a.id = pa.agent_id
      where pa.property_id = properties.id
        and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.property_agents pa
      inner join public.agents a on a.id = pa.agent_id
      where pa.property_id = properties.id
        and a.user_id = auth.uid()
    )
  );

comment on policy "properties_update_co_listing_agent" on public.properties is
  'Co-listed agents may update listing fields; listed_by must stay the primary owner.';
