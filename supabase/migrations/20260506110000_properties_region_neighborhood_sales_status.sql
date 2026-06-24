-- Marketplace location hierarchy and listing sales status persistence.
alter table public.properties add column if not exists region text;
alter table public.properties add column if not exists neighborhood text;
alter table public.properties add column if not exists sales_status text;

comment on column public.properties.region is 'Normalized region/province label derived from Google Places address components.';
comment on column public.properties.neighborhood is 'Neighborhood/sub-locality label used for featured location filters.';
comment on column public.properties.sales_status is 'Sale lifecycle label for listing cards, including presale-specific status.';

create index if not exists idx_properties_region on public.properties (region);
create index if not exists idx_properties_neighborhood on public.properties (neighborhood);
create index if not exists idx_properties_sales_status on public.properties (sales_status);
