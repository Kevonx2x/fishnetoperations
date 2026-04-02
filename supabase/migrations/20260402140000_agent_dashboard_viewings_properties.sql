-- Agent dashboard: profile extras, property descriptions, viewing requests, listing insert RLS, avatars bucket.

-- ---------------------------------------------------------------------------
-- Agents: specialties, service areas, social links (JSON: { instagram, facebook, linkedin, website })
-- ---------------------------------------------------------------------------
alter table public.agents add column if not exists specialties text;
alter table public.agents add column if not exists service_areas text;
alter table public.agents add column if not exists social_links jsonb not null default '{}'::jsonb;

comment on column public.agents.specialties is 'Comma-separated or free-text specialties for marketplace profile';
comment on column public.agents.service_areas is 'Comma-separated service areas / cities';
comment on column public.agents.social_links is 'Social URLs as JSON object';

-- ---------------------------------------------------------------------------
-- Properties: marketing description
-- ---------------------------------------------------------------------------
alter table public.properties add column if not exists description text;

comment on column public.properties.description is 'Long-form listing description';

-- ---------------------------------------------------------------------------
-- Viewing requests (private to listing agent)
-- ---------------------------------------------------------------------------
create table if not exists public.viewing_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  agent_user_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  client_name text not null,
  client_email text not null,
  client_phone text,
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'rescheduled')),
  notes text
);

create index if not exists viewing_requests_agent_user_id_idx on public.viewing_requests (agent_user_id);
create index if not exists viewing_requests_property_id_idx on public.viewing_requests (property_id);

drop trigger if exists viewing_requests_updated_at on public.viewing_requests;
create trigger viewing_requests_updated_at
  before update on public.viewing_requests
  for each row execute function public.set_updated_at();

alter table public.viewing_requests enable row level security;

drop policy if exists "viewing_requests_select_own" on public.viewing_requests;
create policy "viewing_requests_select_own"
  on public.viewing_requests for select
  to authenticated
  using (agent_user_id = auth.uid() or public.is_admin());

drop policy if exists "viewing_requests_insert_own" on public.viewing_requests;
create policy "viewing_requests_insert_own"
  on public.viewing_requests for insert
  to authenticated
  with check (agent_user_id = auth.uid() or public.is_admin());

drop policy if exists "viewing_requests_update_own" on public.viewing_requests;
create policy "viewing_requests_update_own"
  on public.viewing_requests for update
  to authenticated
  using (agent_user_id = auth.uid() or public.is_admin())
  with check (agent_user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Properties: agents can create/update rows they list
-- ---------------------------------------------------------------------------
drop policy if exists "properties_insert_listing_owner" on public.properties;
create policy "properties_insert_listing_owner"
  on public.properties for insert
  to authenticated
  with check (listed_by = auth.uid());

drop policy if exists "properties_update_listing_owner" on public.properties;
create policy "properties_update_listing_owner"
  on public.properties for update
  to authenticated
  using (listed_by = auth.uid())
  with check (listed_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: public bucket for agent avatars (path: {user_id}/avatar-*.ext)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('agent-avatars', 'agent-avatars', true)
on conflict (id) do nothing;

drop policy if exists "agent_avatars_public_read" on storage.objects;
create policy "agent_avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'agent-avatars');

drop policy if exists "agent_avatars_upload_own" on storage.objects;
create policy "agent_avatars_upload_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'agent-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "agent_avatars_update_own" on storage.objects;
create policy "agent_avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'agent-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "agent_avatars_delete_own" on storage.objects;
create policy "agent_avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'agent-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
