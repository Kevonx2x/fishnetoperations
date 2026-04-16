-- Dashboard "My Team" roster (CRM-style contacts per listing agent).
-- Distinct from public.team_members (BahayGo internal admin) and public.agent_team_members (showing invites).

create table if not exists public.agent_managed_team_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  name text not null,
  role text not null check (
    role in (
      'Co-Agent',
      'Admin Assistant',
      'Virtual Assistant',
      'Marketing',
      'Other'
    )
  ),
  email text not null,
  phone text
);

create index if not exists agent_managed_team_members_agent_id_idx
  on public.agent_managed_team_members (agent_id);

alter table public.agent_managed_team_members enable row level security;

drop policy if exists "agent_managed_team_members_select_own" on public.agent_managed_team_members;
create policy "agent_managed_team_members_select_own"
  on public.agent_managed_team_members for select to authenticated
  using (agent_id in (select id from public.agents where user_id = auth.uid()));

drop policy if exists "agent_managed_team_members_insert_own" on public.agent_managed_team_members;
create policy "agent_managed_team_members_insert_own"
  on public.agent_managed_team_members for insert to authenticated
  with check (agent_id in (select id from public.agents where user_id = auth.uid()));

drop policy if exists "agent_managed_team_members_update_own" on public.agent_managed_team_members;
create policy "agent_managed_team_members_update_own"
  on public.agent_managed_team_members for update to authenticated
  using (agent_id in (select id from public.agents where user_id = auth.uid()))
  with check (agent_id in (select id from public.agents where user_id = auth.uid()));

drop policy if exists "agent_managed_team_members_delete_own" on public.agent_managed_team_members;
create policy "agent_managed_team_members_delete_own"
  on public.agent_managed_team_members for delete to authenticated
  using (agent_id in (select id from public.agents where user_id = auth.uid()));

comment on table public.agent_managed_team_members is 'Agent dashboard Team tab: named contacts with role/email/phone';
