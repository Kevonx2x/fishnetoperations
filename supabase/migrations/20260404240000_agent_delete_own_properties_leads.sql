-- Agents can delete their own listings and assigned leads
drop policy if exists "properties_delete_listing_owner" on public.properties;
create policy "properties_delete_listing_owner"
  on public.properties for delete
  to authenticated
  using (listed_by = auth.uid() or public.is_admin());

drop policy if exists "leads_delete_own_agent" on public.leads;
create policy "leads_delete_own_agent"
  on public.leads for delete
  to authenticated
  using (agent_id = auth.uid() or public.is_admin());
