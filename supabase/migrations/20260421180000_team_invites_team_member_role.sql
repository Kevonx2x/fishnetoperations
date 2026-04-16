-- Team member invites (agent roster) on public.team_members + profile role team_member.
-- Internal admin rows keep agent_id null; agent-invited rows set agent_id → agents(id).

-- ---------------------------------------------------------------------------
-- profiles.role: add team_member
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'broker', 'agent', 'client', 'team_member'));

-- ---------------------------------------------------------------------------
-- Auto profile: support team_member from auth metadata + persist email
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  r := coalesce(new.raw_user_meta_data->>'role', 'client');
  if r <> 'team_member' then
    r := 'client';
  end if;
  insert into public.profiles (id, full_name, avatar_url, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    r,
    new.email
  );
  return new;
exception
  when unique_violation then
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- team_members: agent invites + invite lifecycle
-- ---------------------------------------------------------------------------
alter table public.team_members drop constraint if exists team_members_role_check;

alter table public.team_members
  add column if not exists agent_id uuid references public.agents (id) on delete cascade;
alter table public.team_members add column if not exists phone text;
alter table public.team_members add column if not exists status text;
alter table public.team_members add column if not exists invite_token uuid;
alter table public.team_members add column if not exists invite_expires_at timestamptz;
alter table public.team_members add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.team_members add column if not exists accepted_at timestamptz;

alter table public.team_members drop constraint if exists team_members_email_key;

alter table public.team_members
  add constraint team_members_role_check check (
    (agent_id is null and role in ('owner', 'co_founder', 'va_admin'))
    or (agent_id is not null)
  );

alter table public.team_members
  add constraint team_members_status_check check (
    status is null or status in ('pending', 'active', 'revoked')
  );

update public.team_members
set status = 'active'
where agent_id is null and (status is null or status = '');

create unique index if not exists team_members_admin_email_lower_uidx
  on public.team_members (lower(email))
  where agent_id is null;

create unique index if not exists team_members_agent_invite_email_uidx
  on public.team_members (agent_id, lower(trim(email)))
  where agent_id is not null;

create unique index if not exists team_members_invite_token_uidx
  on public.team_members (invite_token)
  where invite_token is not null;

-- ---------------------------------------------------------------------------
-- RLS: agent roster + invited user reads own row
-- ---------------------------------------------------------------------------
drop policy if exists "team_members_select_agent_roster" on public.team_members;
create policy "team_members_select_agent_roster"
  on public.team_members for select to authenticated
  using (
    agent_id is not null
    and agent_id in (select id from public.agents where user_id = auth.uid())
  );

drop policy if exists "team_members_select_self_invited" on public.team_members;
create policy "team_members_select_self_invited"
  on public.team_members for select to authenticated
  using (user_id is not null and user_id = auth.uid());

drop policy if exists "team_members_update_agent_roster" on public.team_members;
create policy "team_members_update_agent_roster"
  on public.team_members for update to authenticated
  using (
    agent_id is not null
    and agent_id in (select id from public.agents where user_id = auth.uid())
  )
  with check (
    agent_id is not null
    and agent_id in (select id from public.agents where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Leads: team members can read/update supervisor pipeline
-- ---------------------------------------------------------------------------
drop policy if exists "leads_select_staff" on public.leads;
create policy "leads_select_staff"
  on public.leads for select to authenticated
  using (
    public.is_admin()
    or agent_id = auth.uid()
    or broker_id = auth.uid()
    or client_id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      join public.agents ag on ag.id = tm.agent_id
      where tm.user_id = auth.uid()
        and tm.status = 'active'
        and public.leads.agent_id = ag.user_id
    )
  );

drop policy if exists "leads_update_staff" on public.leads;
create policy "leads_update_staff"
  on public.leads for update to authenticated
  using (
    public.is_admin()
    or agent_id = auth.uid()
    or broker_id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      join public.agents ag on ag.id = tm.agent_id
      where tm.user_id = auth.uid()
        and tm.status = 'active'
        and public.leads.agent_id = ag.user_id
    )
  )
  with check (
    public.is_admin()
    or agent_id = auth.uid()
    or broker_id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      join public.agents ag on ag.id = tm.agent_id
      where tm.user_id = auth.uid()
        and tm.status = 'active'
        and public.leads.agent_id = ag.user_id
    )
  );

-- ---------------------------------------------------------------------------
-- Lead history: team members aligned with leads access
-- ---------------------------------------------------------------------------
drop policy if exists "lead_status_history_select_staff" on public.lead_status_history;
create policy "lead_status_history_select_staff"
  on public.lead_status_history for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_id
        and (
          l.agent_id = auth.uid()
          or l.broker_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            join public.agents ag on ag.id = tm.agent_id
            where tm.user_id = auth.uid()
              and tm.status = 'active'
              and l.agent_id = ag.user_id
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Deal documents: team members for supervisor leads
-- ---------------------------------------------------------------------------
drop policy if exists "deal_documents_select_staff" on public.deal_documents;
create policy "deal_documents_select_staff"
  on public.deal_documents for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (
          l.agent_id = auth.uid()
          or l.broker_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            join public.agents ag on ag.id = tm.agent_id
            where tm.user_id = auth.uid()
              and tm.status = 'active'
              and l.agent_id = ag.user_id
          )
        )
    )
  );

drop policy if exists "deal_documents_insert_staff" on public.deal_documents;
create policy "deal_documents_insert_staff"
  on public.deal_documents for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (
          l.agent_id = auth.uid()
          or l.broker_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            join public.agents ag on ag.id = tm.agent_id
            where tm.user_id = auth.uid()
              and tm.status = 'active'
              and l.agent_id = ag.user_id
          )
        )
    )
  );

drop policy if exists "deal_documents_update_staff" on public.deal_documents;
create policy "deal_documents_update_staff"
  on public.deal_documents for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (
          l.agent_id = auth.uid()
          or l.broker_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            join public.agents ag on ag.id = tm.agent_id
            where tm.user_id = auth.uid()
              and tm.status = 'active'
              and l.agent_id = ag.user_id
          )
        )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (
          l.agent_id = auth.uid()
          or l.broker_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            join public.agents ag on ag.id = tm.agent_id
            where tm.user_id = auth.uid()
              and tm.status = 'active'
              and l.agent_id = ag.user_id
          )
        )
    )
  );

drop policy if exists "deal_documents_delete_staff" on public.deal_documents;
create policy "deal_documents_delete_staff"
  on public.deal_documents for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = deal_documents.lead_id
        and (
          l.agent_id = auth.uid()
          or l.broker_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            join public.agents ag on ag.id = tm.agent_id
            where tm.user_id = auth.uid()
              and tm.status = 'active'
              and l.agent_id = ag.user_id
          )
        )
    )
  );

comment on table public.team_members is 'Internal admin team (agent_id null) + agent-invited roster (agent_id set, invite_token lifecycle)';
