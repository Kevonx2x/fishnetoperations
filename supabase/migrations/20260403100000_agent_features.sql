-- Agent dashboard: templates, lead notes, viewing reminders

-- ---------------------------------------------------------------------------
-- viewing_requests: reminder fields (client_phone may already exist)
-- ---------------------------------------------------------------------------
alter table public.viewing_requests add column if not exists reminder_minutes integer not null default 60;
alter table public.viewing_requests add column if not exists reminder_sent boolean not null default false;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'viewing_requests_reminder_minutes_check'
  ) then
    null;
  else
    alter table public.viewing_requests
      add constraint viewing_requests_reminder_minutes_check
      check (reminder_minutes > 0 and reminder_minutes <= 10080);
  end if;
exception when others then
  null;
end $$;

-- ---------------------------------------------------------------------------
-- lead_notes (private per agent)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  constraint lead_notes_length check (char_length(note) <= 500)
);

create index if not exists lead_notes_lead_id_idx on public.lead_notes (lead_id);
create index if not exists lead_notes_agent_id_idx on public.lead_notes (agent_id);

alter table public.lead_notes enable row level security;

drop policy if exists "lead_notes_select_own" on public.lead_notes;
create policy "lead_notes_select_own"
  on public.lead_notes for select
  to authenticated
  using (agent_id = auth.uid());

drop policy if exists "lead_notes_insert_own" on public.lead_notes;
create policy "lead_notes_insert_own"
  on public.lead_notes for insert
  to authenticated
  with check (agent_id = auth.uid());

drop policy if exists "lead_notes_update_own" on public.lead_notes;
create policy "lead_notes_update_own"
  on public.lead_notes for update
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

drop policy if exists "lead_notes_delete_own" on public.lead_notes;
create policy "lead_notes_delete_own"
  on public.lead_notes for delete
  to authenticated
  using (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- agent_templates (custom + optional default flag)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_templates (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agent_templates_agent_id_idx on public.agent_templates (agent_id);

alter table public.agent_templates enable row level security;

drop policy if exists "agent_templates_select_own" on public.agent_templates;
create policy "agent_templates_select_own"
  on public.agent_templates for select
  to authenticated
  using (agent_id = auth.uid());

drop policy if exists "agent_templates_insert_own" on public.agent_templates;
create policy "agent_templates_insert_own"
  on public.agent_templates for insert
  to authenticated
  with check (agent_id = auth.uid());

drop policy if exists "agent_templates_update_own" on public.agent_templates;
create policy "agent_templates_update_own"
  on public.agent_templates for update
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

drop policy if exists "agent_templates_delete_own" on public.agent_templates;
create policy "agent_templates_delete_own"
  on public.agent_templates for delete
  to authenticated
  using (agent_id = auth.uid());
