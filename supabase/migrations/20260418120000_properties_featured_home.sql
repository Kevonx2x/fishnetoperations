-- Single homepage featured listing (admin-controlled)
alter table public.properties add column if not exists featured boolean not null default false;

comment on column public.properties.featured is 'When true, shown as featured on marketplace home; at most one row should be true';

create unique index if not exists properties_one_featured_true
  on public.properties (featured)
  where featured = true;
