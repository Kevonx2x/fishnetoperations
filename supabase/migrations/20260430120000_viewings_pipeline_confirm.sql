-- Pipeline-confirmed viewings (one row per lead) + client-requested slot hints on viewing_requests.

-- ---------------------------------------------------------------------------
-- viewing_requests: optional preferred slot (separate from scheduled_at)
-- ---------------------------------------------------------------------------
alter table public.viewing_requests add column if not exists preferred_date date;
alter table public.viewing_requests add column if not exists preferred_time text;

comment on column public.viewing_requests.preferred_date is 'Client-preferred viewing date (calendar day, agent timezone context in app)';
comment on column public.viewing_requests.preferred_time is 'Client-preferred viewing time label or HH:mm';

-- ---------------------------------------------------------------------------
-- viewings: agent-scheduled pipeline viewing (calendar + reminders)
-- ---------------------------------------------------------------------------
create table if not exists public.viewings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id bigint not null references public.leads (id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  notes text
);

create unique index if not exists viewings_lead_id_uidx on public.viewings (lead_id);

alter table public.viewings add column if not exists notes text;

drop trigger if exists viewings_updated_at on public.viewings;
create trigger viewings_updated_at
  before update on public.viewings
  for each row execute function public.set_updated_at();

alter table public.viewings enable row level security;

drop policy if exists "viewings_select_staff" on public.viewings;
create policy "viewings_select_staff"
  on public.viewings for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = viewings.lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

drop policy if exists "viewings_insert_staff" on public.viewings;
create policy "viewings_insert_staff"
  on public.viewings for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = viewings.lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );

drop policy if exists "viewings_update_staff" on public.viewings;
create policy "viewings_update_staff"
  on public.viewings for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = viewings.lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = viewings.lead_id
        and (l.agent_id = auth.uid() or l.broker_id = auth.uid())
    )
  );
