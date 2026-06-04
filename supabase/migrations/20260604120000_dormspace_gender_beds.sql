-- Per-gender bed inventory, pricing, and landlord browse visibility

alter table public.dormspaces
  add column if not exists male_beds_total integer not null default 0,
  add column if not exists male_beds_available integer not null default 0,
  add column if not exists female_beds_total integer not null default 0,
  add column if not exists female_beds_available integer not null default 0,
  add column if not exists male_monthly_price numeric,
  add column if not exists female_monthly_price numeric,
  add column if not exists hidden_from_browse boolean not null default false;

alter table public.dormspaces drop constraint if exists dormspaces_male_beds_total_check;
alter table public.dormspaces
  add constraint dormspaces_male_beds_total_check
  check (male_beds_total >= 0 and male_beds_total <= 50);

alter table public.dormspaces drop constraint if exists dormspaces_female_beds_total_check;
alter table public.dormspaces
  add constraint dormspaces_female_beds_total_check
  check (female_beds_total >= 0 and female_beds_total <= 50);

alter table public.dormspaces drop constraint if exists dormspaces_male_beds_available_check;
alter table public.dormspaces
  add constraint dormspaces_male_beds_available_check
  check (male_beds_available >= 0 and male_beds_available <= male_beds_total);

alter table public.dormspaces drop constraint if exists dormspaces_female_beds_available_check;
alter table public.dormspaces
  add constraint dormspaces_female_beds_available_check
  check (female_beds_available >= 0 and female_beds_available <= female_beds_total);

-- Backfill from legacy columns (single pass)
update public.dormspaces d
set
  male_beds_total = case
    when d.gender_preference = 'male' then greatest(1, coalesce(d.total_beds, 1))
    when d.gender_preference = 'any' and d.room_type = 'private' then 1
    when d.gender_preference = 'any' then greatest(0, (coalesce(d.total_beds, 1) + 1) / 2)
    else 0
  end,
  male_beds_available = case
    when d.gender_preference = 'male' then greatest(0, least(coalesce(d.available_beds, d.total_beds, 1), coalesce(d.total_beds, 1)))
    when d.gender_preference = 'any' and d.room_type = 'private' then greatest(0, least(1, coalesce(d.available_beds, 1)))
    when d.gender_preference = 'any' then greatest(0, (coalesce(d.available_beds, d.total_beds, 1) + 1) / 2)
    else 0
  end,
  female_beds_total = case
    when d.gender_preference = 'female' then greatest(1, coalesce(d.total_beds, 1))
    when d.gender_preference = 'any' and d.room_type = 'private' then 0
    when d.gender_preference = 'any' then greatest(0, coalesce(d.total_beds, 1) / 2)
    else 0
  end,
  female_beds_available = case
    when d.gender_preference = 'female' then greatest(0, least(coalesce(d.available_beds, d.total_beds, 1), coalesce(d.total_beds, 1)))
    when d.gender_preference = 'any' and d.room_type = 'private' then 0
    when d.gender_preference = 'any' then greatest(0, coalesce(d.available_beds, d.total_beds, 1) / 2)
    else 0
  end,
  male_monthly_price = case when d.gender_preference in ('male', 'any') then d.monthly_price else null end,
  female_monthly_price = case when d.gender_preference in ('female', 'any') then d.monthly_price else null end;

update public.dormspaces
set
  total_beds = greatest(1, male_beds_total + female_beds_total),
  available_beds = male_beds_available + female_beds_available,
  gender_preference = case
    when male_beds_total > 0 and female_beds_total > 0 then 'any'
    when male_beds_total > 0 then 'male'
    when female_beds_total > 0 then 'female'
    else gender_preference
  end,
  monthly_price = coalesce(
    least(nullif(male_monthly_price, 0), nullif(female_monthly_price, 0)),
    male_monthly_price,
    female_monthly_price,
    monthly_price
  )
where male_beds_total + female_beds_total > 0;

comment on column public.dormspaces.male_beds_total is 'Total male bed capacity.';
comment on column public.dormspaces.male_beds_available is 'Male beds open for new tenants.';
comment on column public.dormspaces.female_beds_total is 'Total female bed capacity.';
comment on column public.dormspaces.female_beds_available is 'Female beds open for new tenants.';
comment on column public.dormspaces.male_monthly_price is 'Monthly rent per male bed (PHP).';
comment on column public.dormspaces.female_monthly_price is 'Monthly rent per female bed (PHP).';
comment on column public.dormspaces.hidden_from_browse is 'Landlord hid listing from public browse; still on landlord dashboard.';

notify pgrst, 'reload schema';
