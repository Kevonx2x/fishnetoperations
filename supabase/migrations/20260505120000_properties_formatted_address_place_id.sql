-- Google Places persistence (safe if columns already exist from manual deploy).
alter table public.properties add column if not exists formatted_address text;
alter table public.properties add column if not exists place_id text;

comment on column public.properties.formatted_address is 'Google Places formatted_address when chosen from autocomplete';
comment on column public.properties.place_id is 'Google Places place_id when chosen from autocomplete';
