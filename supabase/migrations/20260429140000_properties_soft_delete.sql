-- Soft delete: listings stay in DB for analytics; public app hides rows with deleted_at set.

alter table public.properties
  add column if not exists deleted_at timestamptz;

comment on column public.properties.deleted_at is
  'When set, listing is removed from public discovery but retained for analytics; owner dashboards still see the row.';

create index if not exists properties_deleted_at_idx on public.properties (deleted_at);
