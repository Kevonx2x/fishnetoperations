-- Presale developments: optional overlay on listings (typically status for_sale)

alter table public.properties add column if not exists is_presale boolean not null default false;
alter table public.properties add column if not exists developer_name text;
alter table public.properties add column if not exists turnover_date date;
alter table public.properties add column if not exists unit_types text[] not null default '{}';

create index if not exists properties_is_presale_idx on public.properties (is_presale) where is_presale = true;

comment on column public.properties.is_presale is 'True when listing is a presale development (property_type Presale)';
comment on column public.properties.developer_name is 'Developer name when is_presale';
comment on column public.properties.turnover_date is 'Expected turnover date when is_presale';
comment on column public.properties.unit_types is 'Available unit type labels when is_presale';
