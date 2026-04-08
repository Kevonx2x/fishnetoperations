-- Public read of client profiles (for /clients/[id]); Pro/Featured agents can read clients' saved_properties.

drop policy if exists "profiles_select_public_client_role" on public.profiles;
create policy "profiles_select_public_client_role"
  on public.profiles for select
  to anon, authenticated
  using (role = 'client');

-- Verified Pro, Featured, or Broker-tier agents may read any client's saved_properties rows (client interest insights).
drop policy if exists "saved_properties_select_agent_pro_viewing_clients" on public.saved_properties;
create policy "saved_properties_select_agent_pro_viewing_clients"
  on public.saved_properties for select
  to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.user_id = auth.uid()
        and a.verified = true
        and a.status = 'approved'
        and a.listing_tier in ('pro', 'featured', 'broker')
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = saved_properties.user_id
        and p.role = 'client'
    )
  );
