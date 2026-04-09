-- Listing owners and co-listed agents can read property_likes rows for their listings
-- (who liked each property on /agents/[id] for the listing owner).

drop policy if exists "property_likes_select_agent_own_listing" on public.property_likes;

create policy "property_likes_select_agent_own_listing"
  on public.property_likes for select
  to authenticated
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_likes.property_id
        and p.listed_by = auth.uid()
    )
    or exists (
      select 1
      from public.property_agents pa
      inner join public.agents a on a.id = pa.agent_id
      where pa.property_id = property_likes.property_id
        and a.user_id = auth.uid()
    )
  );

comment on policy "property_likes_select_agent_own_listing" on public.property_likes is
  'Listing owner or co-agent can read likes on their properties (engagement preview).';
