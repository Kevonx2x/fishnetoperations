-- Bed capacity tracking: one listing = one property with N beds

alter table public.dormspaces
  add column if not exists total_beds integer default 1,
  add column if not exists available_beds integer default 1,
  add column if not exists vacancy_notes text;

alter table public.dormspaces drop constraint if exists dormspaces_total_beds_check;
alter table public.dormspaces
  add constraint dormspaces_total_beds_check
  check (total_beds >= 1 and total_beds <= 50);

alter table public.dormspaces drop constraint if exists dormspaces_available_beds_check;
alter table public.dormspaces
  add constraint dormspaces_available_beds_check
  check (available_beds >= 0);

alter table public.dormspaces drop constraint if exists dormspaces_available_beds_max;
alter table public.dormspaces
  add constraint dormspaces_available_beds_max
  check (available_beds <= total_beds);

update public.dormspaces
set
  total_beds = case
    when room_type = 'private' then 1
    when room_type = 'shared_2' then 2
    when room_type = 'shared_4' then 4
    when room_type = 'shared_6_plus' then 6
    else 1
  end,
  available_beds = case
    when room_type = 'private' then 1
    when room_type = 'shared_2' then 2
    when room_type = 'shared_4' then 4
    when room_type = 'shared_6_plus' then 6
    else 1
  end
where total_beds is null
   or available_beds is null
   or (total_beds = 1 and available_beds = 1 and room_type <> 'private');

comment on column public.dormspaces.total_beds is 'Total bed capacity at this property.';
comment on column public.dormspaces.available_beds is 'Beds currently open for new tenants.';
comment on column public.dormspaces.vacancy_notes is 'Optional tenant-facing note about upcoming availability.';

notify pgrst, 'reload schema';
