-- Allow viewing requests without a specific listing (e.g. from agent profile "Schedule").
alter table public.viewing_requests
  alter column property_id drop not null;

comment on column public.viewing_requests.property_id is 'Listing UUID when tied to a property; null for general agent viewing requests.';

drop policy if exists "viewing_requests_insert_as_client_for_agent_general" on public.viewing_requests;

create policy "viewing_requests_insert_as_client_for_agent_general"
  on public.viewing_requests for insert
  to authenticated
  with check (
    viewing_requests.property_id is null
    and exists (
      select 1
      from public.agents a
      where a.user_id = viewing_requests.agent_user_id
    )
  );
