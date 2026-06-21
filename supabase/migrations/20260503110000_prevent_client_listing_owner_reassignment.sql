-- Prevent browser/authenticated clients from reassigning listing ownership.
-- Co-listing agents may update listing details through RLS, but `listed_by`
-- is the ownership boundary used by dashboards, uploads, notifications, and limits.

create or replace function public.prevent_client_property_listed_by_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.listed_by is distinct from old.listed_by
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'properties.listed_by cannot be changed by authenticated clients'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists properties_prevent_client_listed_by_change on public.properties;

create trigger properties_prevent_client_listed_by_change
  before update of listed_by on public.properties
  for each row
  execute function public.prevent_client_property_listed_by_change();

comment on function public.prevent_client_property_listed_by_change is
  'Blocks authenticated/browser updates to properties.listed_by; service-role admin APIs may still perform intentional reassignment.';
