-- Enriched landlord public profile fields (tenant-facing on dormspace detail)

alter table public.profiles add column if not exists landlord_cover_url text;
alter table public.profiles add column if not exists landlord_specialties text[];
alter table public.profiles add column if not exists landlord_operating_areas text[];
alter table public.profiles add column if not exists landlord_facebook_url text;
alter table public.profiles add column if not exists landlord_instagram_url text;
alter table public.profiles add column if not exists landlord_about_properties text;

comment on column public.profiles.landlord_cover_url is 'Optional banner shown on landlord dormspace listings.';
comment on column public.profiles.landlord_specialties is 'Landlord housing focus tags (tenant-facing).';
comment on column public.profiles.landlord_operating_areas is 'Cities/neighborhoods where landlord operates.';
comment on column public.profiles.landlord_facebook_url is 'Optional Facebook profile URL for social verification.';
comment on column public.profiles.landlord_instagram_url is 'Optional Instagram profile URL for social verification.';
comment on column public.profiles.landlord_about_properties is 'Short note about landlord properties in general (max ~300 chars in app).';

notify pgrst, 'reload schema';
