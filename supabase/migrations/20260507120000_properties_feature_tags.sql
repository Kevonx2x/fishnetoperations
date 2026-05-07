-- Listing feature tags (marketplace filters / agent listing form)

alter table public.properties add column if not exists pet_friendly boolean not null default false;
alter table public.properties add column if not exists near_schools boolean not null default false;
alter table public.properties add column if not exists family_friendly boolean not null default false;

comment on column public.properties.pet_friendly is 'Agent-marked: listing welcomes pets';
comment on column public.properties.near_schools is 'Agent-marked: listing is near schools';
comment on column public.properties.family_friendly is 'Agent-marked: suitable for families (e.g. 3+ beds or play area)';
