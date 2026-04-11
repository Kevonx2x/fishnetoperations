-- Import listing deduplication (URL + content hash)
alter table public.properties add column if not exists source_url text;
alter table public.properties add column if not exists source_hash text;

create unique index if not exists properties_source_url_unique
  on public.properties (source_url)
  where source_url is not null and trim(source_url) <> '';

create index if not exists idx_properties_source_hash on public.properties (source_hash)
  where source_hash is not null;

comment on column public.properties.source_url is 'Original listing URL when imported';
comment on column public.properties.source_hash is 'SHA-256 of normalized title|price|location for dedup';
