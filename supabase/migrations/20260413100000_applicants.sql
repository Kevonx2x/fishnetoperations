-- Job applicants for admin Hiring tab (admin-only via RLS; API uses service role).

create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  age integer not null,
  email text not null,
  notes text,
  status text not null default 'New',
  constraint applicants_age_reasonable check (age >= 0 and age <= 120),
  constraint applicants_status_valid check (
    status in ('New', 'Interviewed', 'Hired', 'Rejected')
  )
);

create index if not exists applicants_created_at_idx on public.applicants (created_at desc);

alter table public.applicants enable row level security;

drop policy if exists "applicants_admin_all" on public.applicants;
create policy "applicants_admin_all"
  on public.applicants
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.applicants is 'Internal hiring pipeline; readable/writable only by admins.';
