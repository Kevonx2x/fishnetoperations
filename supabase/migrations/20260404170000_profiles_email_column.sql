-- Optional contact email on profile (can mirror auth or be set in app).
alter table public.profiles add column if not exists email text;

comment on column public.profiles.email is 'Contact email when stored on profile; agents.email / mapRowToMarketplaceAgent may also use this as fallback.';
