-- Extra fields on viewing requests (occupants, pets, preferred move-in)

alter table public.viewing_requests add column if not exists occupant_count integer not null default 1;
alter table public.viewing_requests add column if not exists has_pets boolean not null default false;
alter table public.viewing_requests add column if not exists preferred_move_in_date date;

alter table public.viewing_requests drop constraint if exists viewing_requests_occupant_count_check;
alter table public.viewing_requests
  add constraint viewing_requests_occupant_count_check
  check (occupant_count >= 1 and occupant_count <= 50);

comment on column public.viewing_requests.occupant_count is 'Number of people moving in';
comment on column public.viewing_requests.has_pets is 'Whether the client has pets';
comment on column public.viewing_requests.preferred_move_in_date is 'Target move-in date (separate from viewing appointment)';
