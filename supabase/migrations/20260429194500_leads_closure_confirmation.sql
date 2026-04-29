-- Closure confirmation tracking for closed deals (agent marks closed, client confirms later)

alter table public.leads add column if not exists closed_at timestamptz;
alter table public.leads add column if not exists closed_by uuid references public.profiles (id) on delete set null;
alter table public.leads add column if not exists closure_confirmed_by_client boolean;
alter table public.leads add column if not exists closure_note text;

comment on column public.leads.closed_at is 'Timestamp when agent marked deal as closed (separate from closed_date used for scoring).';
comment on column public.leads.closed_by is 'Profile id that marked the deal closed.';
comment on column public.leads.closure_confirmed_by_client is 'NULL=pending, TRUE=confirmed, FALSE=disputed.';
comment on column public.leads.closure_note is 'Optional note added by agent when marking deal closed.';

update public.leads
set closed_at = coalesce(closed_at, closed_date, updated_at)
where pipeline_stage = 'closed'
  and closed_at is null;

