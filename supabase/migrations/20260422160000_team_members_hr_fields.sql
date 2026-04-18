-- HR-style fields for internal team_members; migrate trial_start_date -> start_date.

alter table public.team_members add column if not exists start_date date;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'team_members' and column_name = 'trial_start_date'
  ) then
    update public.team_members
    set start_date = coalesce(start_date, trial_start_date)
    where trial_start_date is not null;
    alter table public.team_members drop column trial_start_date;
  end if;
end $$;

alter table public.team_members add column if not exists department text;
alter table public.team_members add column if not exists employment_type text;
alter table public.team_members add column if not exists rate_amount numeric(14, 2);
alter table public.team_members add column if not exists currency text default 'PHP';
alter table public.team_members add column if not exists rate_period text;
alter table public.team_members add column if not exists hr_notes text;
alter table public.team_members add column if not exists equity_pct numeric(7, 4) default 0;
alter table public.team_members add column if not exists employment_status text default 'Trial';
alter table public.team_members add column if not exists admin_added_by uuid references auth.users (id) on delete set null;

alter table public.team_members drop constraint if exists team_members_currency_check;
alter table public.team_members
  add constraint team_members_currency_check check (currency is null or currency in ('USD', 'PHP'));

alter table public.team_members drop constraint if exists team_members_rate_period_check;
alter table public.team_members
  add constraint team_members_rate_period_check check (
    rate_period is null or rate_period in ('Hourly', 'Monthly', 'Annual')
  );

alter table public.team_members drop constraint if exists team_members_employment_type_hr_check;
alter table public.team_members
  add constraint team_members_employment_type_hr_check check (
    employment_type is null or employment_type in ('Full Time', 'Part Time', 'Contractor', 'Intern')
  );

alter table public.team_members drop constraint if exists team_members_department_hr_check;
alter table public.team_members
  add constraint team_members_department_hr_check check (
    department is null or department in ('Engineering', 'Sales', 'Marketing', 'Operations', 'Design', 'Other')
  );

alter table public.team_members drop constraint if exists team_members_employment_status_hr_check;
alter table public.team_members
  add constraint team_members_employment_status_hr_check check (
    employment_status is null or employment_status in ('Trial', 'Active', 'Terminated', 'On Leave')
  );

update public.team_members
set employment_status = coalesce(employment_status, 'Trial')
where agent_id is null and employment_status is null;
