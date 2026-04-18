-- Deliverable workflow: status + admin feedback; team members can read own deliverables + notes.

alter table public.employee_deliverables
  add column if not exists status text,
  add column if not exists admin_note text;

update public.employee_deliverables set status = 'not_started' where status is null;

alter table public.employee_deliverables alter column status set default 'not_started';
alter table public.employee_deliverables alter column status set not null;

update public.employee_deliverables
set status = case when coalesce(is_complete, false) then 'approved' else 'not_started' end;

update public.employee_deliverables set is_complete = (status = 'approved');

alter table public.employee_deliverables drop constraint if exists employee_deliverables_status_check;
alter table public.employee_deliverables
  add constraint employee_deliverables_status_check check (
    status in ('not_started', 'submitted', 'pending_review', 'approved', 'changes_requested')
  );

drop policy if exists employee_deliverables_select_own on public.employee_deliverables;
create policy employee_deliverables_select_own
  on public.employee_deliverables for select to authenticated
  using (
    employee_id in (select id from public.team_members where user_id = auth.uid())
  );

drop policy if exists employee_read_own_notes on public.employee_notes;
create policy employee_read_own_notes
  on public.employee_notes for select to authenticated
  using (
    employee_id in (select id from public.team_members where user_id = auth.uid())
  );
