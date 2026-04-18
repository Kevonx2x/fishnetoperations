-- 30-day onboarding deliverables per internal team member (agent_id null).

alter table public.team_members add column if not exists trial_start_date date;

create table if not exists public.employee_deliverables (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references public.team_members (id) on delete cascade,
  week_number integer not null check (week_number between 1 and 4),
  deliverable_text text not null,
  priority text not null check (priority in ('Critical', 'High', 'Medium', 'Low')),
  is_complete boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists employee_deliverables_employee_id_idx
  on public.employee_deliverables (employee_id);

comment on table public.employee_deliverables is 'Admin-tracked weekly deliverables for internal team onboarding (30-day plan).';

drop trigger if exists employee_deliverables_updated_at on public.employee_deliverables;
create trigger employee_deliverables_updated_at
before update on public.employee_deliverables
for each row execute function public.set_updated_at();

alter table public.employee_deliverables enable row level security;

drop policy if exists "Admin full access employee_deliverables" on public.employee_deliverables;
create policy "Admin full access employee_deliverables"
on public.employee_deliverables
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Allow admins to update internal team rows (e.g. trial_start_date) alongside agent_roster policies.
drop policy if exists "team_members_update_admin_all" on public.team_members;
create policy "team_members_update_admin_all"
  on public.team_members for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
