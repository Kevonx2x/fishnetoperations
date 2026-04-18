-- HR dashboard: emails, onboarding checklist JSON, tenure end date, equity vesting schedule, admin notes.

alter table public.team_members add column if not exists work_email text;
alter table public.team_members add column if not exists personal_email text;
alter table public.team_members add column if not exists onboarding_checklist jsonb not null default '{}'::jsonb;
alter table public.team_members add column if not exists end_date date;
alter table public.team_members add column if not exists equity_vesting_years numeric(5, 2) not null default 4;
alter table public.team_members add column if not exists equity_cliff_months integer not null default 12;

create table if not exists public.employee_notes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.team_members (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create index if not exists employee_notes_employee_id_created_at_idx
  on public.employee_notes (employee_id, created_at desc);

alter table public.employee_notes enable row level security;

drop policy if exists admin_full_access_employee_notes on public.employee_notes;
create policy admin_full_access_employee_notes
  on public.employee_notes
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
