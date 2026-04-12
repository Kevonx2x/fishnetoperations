-- User-to-user reports (agent/client profile Report button).

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  notes text
);

create index if not exists reports_reported_user_id_idx on public.reports (reported_user_id);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own_reporter" on public.reports;
create policy "reports_insert_own_reporter"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

comment on table public.reports is 'Profile reports: reporter flags another user (reason + notes).';
