-- Multi-broker support for agents.
--
-- The application writes agent_brokers during agent registration/profile edits
-- and reads it on public agent profiles. Keep legacy agents.broker_id as the
-- primary brokerage mirror, and backfill it into the junction table.

create table if not exists public.agent_brokers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  broker_id uuid not null references public.brokers (id) on delete cascade,
  is_primary boolean not null default false,
  unique (agent_id, broker_id)
);

create index if not exists agent_brokers_agent_id_idx on public.agent_brokers (agent_id);
create index if not exists agent_brokers_broker_id_idx on public.agent_brokers (broker_id);
create unique index if not exists agent_brokers_one_primary_idx
  on public.agent_brokers (agent_id)
  where is_primary;

alter table public.agent_brokers enable row level security;

drop policy if exists "agent_brokers_public_read" on public.agent_brokers;
create policy "agent_brokers_public_read"
  on public.agent_brokers for select
  to anon, authenticated
  using (true);

drop policy if exists "agent_brokers_write_own_or_admin" on public.agent_brokers;
create policy "agent_brokers_write_own_or_admin"
  on public.agent_brokers for all
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.agents a
      where a.id = agent_brokers.agent_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.agents a
      where a.id = agent_brokers.agent_id
        and a.user_id = auth.uid()
    )
  );

insert into public.agent_brokers (agent_id, broker_id, is_primary)
select a.id, a.broker_id, true
from public.agents a
where a.broker_id is not null
on conflict (agent_id, broker_id) do update
set is_primary = excluded.is_primary;
