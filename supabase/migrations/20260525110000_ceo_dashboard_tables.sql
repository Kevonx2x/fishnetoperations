-- CEO dashboard checklist and decisions log

create table if not exists public.ceo_checklist_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),
  description text,
  category text not null default 'other' check (
    category in ('operating', 'financial', 'product', 'compliance', 'strategic', 'other')
  ),
  cadence text not null default 'daily' check (
    cadence in ('daily', 'weekly_monday', 'weekly_friday', 'monthly', 'quarterly', 'once')
  ),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  last_completed_at timestamptz,
  last_completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ceo_checklist_items_active_sort
  on public.ceo_checklist_items (is_active, sort_order);
create index if not exists idx_ceo_checklist_items_cadence
  on public.ceo_checklist_items (cadence);

drop trigger if exists ceo_checklist_items_set_updated_at on public.ceo_checklist_items;
create trigger ceo_checklist_items_set_updated_at
  before update on public.ceo_checklist_items
  for each row execute function public.set_updated_at();

create table if not exists public.ceo_checklist_completions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.ceo_checklist_items(id) on delete cascade,
  completed_by uuid references public.profiles(id) on delete set null,
  notes text,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ceo_checklist_completions_item_completed
  on public.ceo_checklist_completions (item_id, completed_at desc);
create index if not exists idx_ceo_checklist_completions_completed_by
  on public.ceo_checklist_completions (completed_by);

create table if not exists public.ceo_decisions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),
  context text,
  decision text not null check (char_length(btrim(decision)) > 0),
  alternatives_considered text,
  reasoning text,
  category text not null default 'other' check (
    category in ('operating', 'financial', 'product', 'compliance', 'strategic', 'other')
  ),
  status text not null default 'active' check (status in ('active', 'reversed', 'superseded')),
  decided_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ceo_decisions_decided_at
  on public.ceo_decisions (decided_at desc);
create index if not exists idx_ceo_decisions_status
  on public.ceo_decisions (status);
create index if not exists idx_ceo_decisions_category
  on public.ceo_decisions (category);

drop trigger if exists ceo_decisions_set_updated_at on public.ceo_decisions;
create trigger ceo_decisions_set_updated_at
  before update on public.ceo_decisions
  for each row execute function public.set_updated_at();

alter table public.ceo_checklist_items enable row level security;
alter table public.ceo_checklist_completions enable row level security;
alter table public.ceo_decisions enable row level security;

drop policy if exists ceo_checklist_items_admin_all on public.ceo_checklist_items;
create policy ceo_checklist_items_admin_all
  on public.ceo_checklist_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists ceo_checklist_completions_admin_all on public.ceo_checklist_completions;
create policy ceo_checklist_completions_admin_all
  on public.ceo_checklist_completions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists ceo_decisions_admin_all on public.ceo_decisions;
create policy ceo_decisions_admin_all
  on public.ceo_decisions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
