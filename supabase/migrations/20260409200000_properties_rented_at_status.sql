-- Rented lifecycle + timestamps; extends status / listing_status checks.

alter table public.properties add column if not exists rented_at timestamptz;

comment on column public.properties.rented_at is 'When listing_status became rented; used for Recently Rented badge / archive.';

alter table public.properties drop constraint if exists properties_listing_status_check;

alter table public.properties add constraint properties_listing_status_check check (
  listing_status in ('active', 'under_offer', 'sold', 'off_market', 'rented')
);

alter table public.properties drop constraint if exists properties_status_check;

alter table public.properties add constraint properties_status_check check (
  status in ('for_sale', 'for_rent', 'sold', 'rented')
);
