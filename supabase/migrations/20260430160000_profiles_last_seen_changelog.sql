-- Post-login "What's New" modal: version user last acknowledged
alter table public.profiles
  add column if not exists last_seen_changelog text null;

comment on column public.profiles.last_seen_changelog is 'Changelog build id shown in the post-login modal (e.g. v1.0).';
