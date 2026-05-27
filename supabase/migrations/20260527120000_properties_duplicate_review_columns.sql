-- Duplicate listing review columns (agent create/update flags; mobile discovery hides losers).

alter table public.properties
  add column if not exists duplicate_of_property_id uuid references public.properties (id) on delete set null,
  add column if not exists flagged_for_admin_review boolean not null default false;

create index if not exists properties_duplicate_of_property_id_idx
  on public.properties (duplicate_of_property_id)
  where duplicate_of_property_id is not null;

create index if not exists properties_flagged_for_admin_review_idx
  on public.properties (flagged_for_admin_review)
  where flagged_for_admin_review = true;

comment on column public.properties.duplicate_of_property_id is
  'When set, this listing is a duplicate of another active property at the same address.';

comment on column public.properties.flagged_for_admin_review is
  'True when the listing matched duplicate detection and needs admin review.';
